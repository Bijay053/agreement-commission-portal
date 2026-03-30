import csv
from collections import Counter
from io import StringIO

from django.db.models import Count
from django.db.models.functions import TruncDate
from django.http import HttpResponse
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import AnonRateThrottle

from core.permissions import require_permission
from .models import Survey, SurveyQuestion, SurveyResponse, SurveyAnswer

VALID_QUESTION_TYPES = {t[0] for t in SurveyQuestion.QUESTION_TYPE_CHOICES}
VALID_STATUSES = {s[0] for s in Survey.STATUS_CHOICES}


def validate_questions(questions):
    if not isinstance(questions, list):
        return 'Questions must be a list'
    for i, q in enumerate(questions):
        if not isinstance(q, dict):
            return f'Question {i+1} must be an object'
        text = q.get('questionText', '').strip()
        if not text:
            return f'Question {i+1} is missing question text'
        qtype = q.get('questionType', '')
        if qtype not in VALID_QUESTION_TYPES:
            return f'Question {i+1} has invalid type: {qtype}'
        if qtype in ('single_choice', 'multiple_choice', 'dropdown'):
            opts = q.get('options', [])
            if not isinstance(opts, list) or len(opts) < 1:
                return f'Question {i+1} requires at least one option'
    return None


def survey_to_dict(survey, include_questions=False):
    data = {
        'id': survey.id,
        'uuid': str(survey.uuid),
        'title': survey.title,
        'description': survey.description,
        'status': survey.status,
        'createdBy': survey.created_by,
        'captchaEnabled': survey.captcha_enabled,
        'createdAt': survey.created_at.isoformat() if survey.created_at else None,
        'updatedAt': survey.updated_at.isoformat() if survey.updated_at else None,
        'responseCount': survey.responses.count(),
    }
    if include_questions:
        data['questions'] = [question_to_dict(q) for q in survey.questions.all()]
    return data


def question_to_dict(question):
    return {
        'id': question.id,
        'questionText': question.question_text,
        'questionType': question.question_type,
        'options': question.options,
        'isRequired': question.is_required,
        'sortOrder': question.sort_order,
        'config': question.config,
    }


def answer_to_dict(answer):
    return {
        'id': answer.id,
        'questionId': answer.question_id,
        'questionText': answer.question.question_text,
        'questionType': answer.question.question_type,
        'answerValue': answer.answer_value,
    }


class SurveyListView(APIView):
    @require_permission('survey.view')
    def get(self, request):
        surveys = Survey.objects.all()
        status_filter = request.query_params.get('status')
        if status_filter:
            surveys = surveys.filter(status=status_filter)
        return Response([survey_to_dict(s) for s in surveys])

    @require_permission('survey.create')
    def post(self, request):
        data = request.data
        title = data.get('title', '').strip()
        if not title:
            return Response({'message': 'Title is required'}, status=400)

        status = data.get('status', 'draft')
        if status not in VALID_STATUSES:
            return Response({'message': f'Invalid status: {status}'}, status=400)

        questions = data.get('questions', [])
        error = validate_questions(questions)
        if error:
            return Response({'message': error}, status=400)

        survey = Survey.objects.create(
            title=title,
            description=data.get('description', ''),
            status=status,
            captcha_enabled=bool(data.get('captchaEnabled', False)),
            created_by=request.session.get('userId'),
        )

        for idx, q in enumerate(questions):
            SurveyQuestion.objects.create(
                survey=survey,
                question_text=q.get('questionText', ''),
                question_type=q.get('questionType', 'short_text'),
                options=q.get('options', []),
                is_required=q.get('isRequired', True),
                sort_order=q.get('sortOrder', idx),
                config=q.get('config', {}),
            )

        survey.refresh_from_db()
        return Response(survey_to_dict(survey, include_questions=True), status=201)


class SurveyDetailView(APIView):
    @require_permission('survey.view')
    def get(self, request, survey_id):
        try:
            survey = Survey.objects.get(id=survey_id)
        except Survey.DoesNotExist:
            return Response({'message': 'Survey not found'}, status=404)
        return Response(survey_to_dict(survey, include_questions=True))

    @require_permission('survey.edit')
    def put(self, request, survey_id):
        try:
            survey = Survey.objects.get(id=survey_id)
        except Survey.DoesNotExist:
            return Response({'message': 'Survey not found'}, status=404)

        data = request.data
        title = data.get('title', '').strip()
        if not title:
            return Response({'message': 'Title is required'}, status=400)

        status = data.get('status', survey.status)
        if status not in VALID_STATUSES:
            return Response({'message': f'Invalid status: {status}'}, status=400)

        if 'questions' in data:
            error = validate_questions(data['questions'])
            if error:
                return Response({'message': error}, status=400)

        survey.title = title
        survey.description = data.get('description', '')
        survey.status = status
        if 'captchaEnabled' in data:
            survey.captcha_enabled = bool(data['captchaEnabled'])
        survey.save()

        if 'questions' in data:
            has_responses = survey.responses.exists()

            if has_responses:
                existing_questions = {q.id: q for q in survey.questions.all()}
                incoming_ids = set()

                for idx, q in enumerate(data['questions']):
                    q_id = q.get('id')
                    if q_id and q_id in existing_questions:
                        incoming_ids.add(q_id)
                        eq = existing_questions[q_id]
                        eq.question_text = q.get('questionText', eq.question_text)
                        eq.question_type = q.get('questionType', eq.question_type)
                        eq.options = q.get('options', eq.options)
                        eq.is_required = q.get('isRequired', eq.is_required)
                        eq.sort_order = q.get('sortOrder', idx)
                        eq.config = q.get('config', eq.config)
                        eq.save()
                    else:
                        SurveyQuestion.objects.create(
                            survey=survey,
                            question_text=q.get('questionText', ''),
                            question_type=q.get('questionType', 'short_text'),
                            options=q.get('options', []),
                            is_required=q.get('isRequired', True),
                            sort_order=q.get('sortOrder', idx),
                            config=q.get('config', {}),
                        )

                for q_id, eq in existing_questions.items():
                    if q_id not in incoming_ids:
                        if not eq.answers.exists():
                            eq.delete()
            else:
                survey.questions.all().delete()
                for idx, q in enumerate(data['questions']):
                    SurveyQuestion.objects.create(
                        survey=survey,
                        question_text=q.get('questionText', ''),
                        question_type=q.get('questionType', 'short_text'),
                        options=q.get('options', []),
                        is_required=q.get('isRequired', True),
                        sort_order=q.get('sortOrder', idx),
                        config=q.get('config', {}),
                    )

        survey.refresh_from_db()
        return Response(survey_to_dict(survey, include_questions=True))

    @require_permission('survey.delete')
    def delete(self, request, survey_id):
        try:
            survey = Survey.objects.get(id=survey_id)
        except Survey.DoesNotExist:
            return Response({'message': 'Survey not found'}, status=404)
        survey.delete()
        return Response({'message': 'Survey deleted'}, status=200)


class SurveySubmitThrottle(AnonRateThrottle):
    rate = '10/minute'


def get_client_ip(request):
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded:
        return x_forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


class PublicSurveyView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, survey_uuid):
        try:
            survey = Survey.objects.get(uuid=survey_uuid)
        except Survey.DoesNotExist:
            return Response({'message': 'Survey not found'}, status=404)

        if survey.status == 'closed':
            return Response({
                'message': 'This survey is closed',
                'closed': True,
                'title': survey.title,
            })

        if survey.status == 'draft':
            return Response({'message': 'Survey not found'}, status=404)

        return Response({
            'title': survey.title,
            'description': survey.description,
            'uuid': str(survey.uuid),
            'questions': [question_to_dict(q) for q in survey.questions.all()],
        })


class PublicSurveySubmitView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = [SurveySubmitThrottle]

    def post(self, request, survey_uuid):
        try:
            survey = Survey.objects.get(uuid=survey_uuid)
        except Survey.DoesNotExist:
            return Response({'message': 'Survey not found'}, status=404)

        if survey.status != 'active':
            return Response({'message': 'This survey is not accepting responses'}, status=400)

        data = request.data

        if data.get('website_url'):
            return Response({'message': 'Thank you for your response!'})

        client_ip = get_client_ip(request)

        if not request.session.session_key:
            request.session.create()
        session_id = request.session.session_key or ''

        submitted_key = f'survey_submitted_{survey.id}'
        if request.session.get(submitted_key):
            return Response({'message': 'You have already submitted this survey', 'duplicate': True}, status=400)

        if session_id:
            existing = SurveyResponse.objects.filter(
                survey=survey,
                session_id=session_id
            ).exists()
            if existing:
                return Response({'message': 'You have already submitted this survey', 'duplicate': True}, status=400)

        answers_data = data.get('answers', {})
        questions = survey.questions.all()

        for question in questions:
            if question.is_required:
                answer = answers_data.get(str(question.id))
                if answer is None or answer == '' or answer == []:
                    return Response({
                        'message': f'"{question.question_text}" is required'
                    }, status=400)

        response_obj = SurveyResponse.objects.create(
            survey=survey,
            respondent_ip=client_ip,
            session_id=session_id,
        )

        for question in questions:
            answer_val = answers_data.get(str(question.id))
            if answer_val is not None:
                SurveyAnswer.objects.create(
                    response=response_obj,
                    question=question,
                    answer_value={'value': answer_val},
                )

        request.session[submitted_key] = True

        return Response({'message': 'Thank you for your response!'}, status=201)


class SurveyResponsesView(APIView):
    @require_permission('survey.view')
    def get(self, request, survey_id):
        try:
            survey = Survey.objects.get(id=survey_id)
        except Survey.DoesNotExist:
            return Response({'message': 'Survey not found'}, status=404)

        responses = survey.responses.all()

        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('pageSize', 20))
        total = responses.count()
        start = (page - 1) * page_size
        end = start + page_size

        paginated = responses[start:end]
        results = []
        for resp in paginated:
            results.append({
                'id': resp.id,
                'submittedAt': resp.submitted_at.isoformat(),
                'respondentIp': resp.respondent_ip,
                'answers': [answer_to_dict(a) for a in resp.answers.select_related('question').all()],
            })

        return Response({
            'results': results,
            'total': total,
            'page': page,
            'pageSize': page_size,
            'totalPages': (total + page_size - 1) // page_size if total > 0 else 1,
        })


class SurveyReportView(APIView):
    @require_permission('survey.view')
    def get(self, request, survey_id):
        try:
            survey = Survey.objects.get(id=survey_id)
        except Survey.DoesNotExist:
            return Response({'message': 'Survey not found'}, status=404)

        questions = survey.questions.all()
        total_responses = survey.responses.count()

        timeline = list(
            survey.responses.annotate(date=TruncDate('submitted_at'))
            .values('date')
            .annotate(count=Count('id'))
            .order_by('date')
        )
        timeline_data = [
            {'date': item['date'].isoformat(), 'count': item['count']}
            for item in timeline
        ]

        question_stats = []
        for question in questions:
            answers = SurveyAnswer.objects.filter(question=question)
            stat = {
                'questionId': question.id,
                'questionText': question.question_text,
                'questionType': question.question_type,
                'totalAnswers': answers.count(),
            }

            if question.question_type in ('rating', 'star_rating', 'range'):
                values = []
                for a in answers:
                    val = a.answer_value.get('value')
                    if val is not None:
                        try:
                            values.append(float(val))
                        except (ValueError, TypeError):
                            pass
                if values:
                    stat['average'] = round(sum(values) / len(values), 2)
                    stat['distribution'] = dict(Counter(str(int(v)) if v == int(v) else str(v) for v in values))
                else:
                    stat['average'] = 0
                    stat['distribution'] = {}

            elif question.question_type in ('single_choice', 'multiple_choice', 'dropdown'):
                counter = Counter()
                for a in answers:
                    val = a.answer_value.get('value')
                    if isinstance(val, list):
                        for v in val:
                            counter[str(v)] += 1
                    elif val is not None:
                        counter[str(val)] += 1
                stat['choiceCounts'] = dict(counter)

            elif question.question_type in ('short_text', 'long_text'):
                stat['sampleAnswers'] = [
                    a.answer_value.get('value', '')
                    for a in answers[:10]
                ]

            question_stats.append(stat)

        return Response({
            'surveyId': survey.id,
            'title': survey.title,
            'totalResponses': total_responses,
            'timeline': timeline_data,
            'questionStats': question_stats,
        })


class SurveyExportView(APIView):
    @require_permission('survey.export')
    def get(self, request, survey_id):
        try:
            survey = Survey.objects.get(id=survey_id)
        except Survey.DoesNotExist:
            return Response({'message': 'Survey not found'}, status=404)

        questions = list(survey.questions.all())
        responses = survey.responses.prefetch_related('answers__question').all()

        output = StringIO()
        writer = csv.writer(output)

        header = ['Response ID', 'Submitted At', 'IP Address']
        for q in questions:
            header.append(q.question_text)
        writer.writerow(header)

        for resp in responses:
            row = [resp.id, resp.submitted_at.isoformat(), resp.respondent_ip or '']
            answer_map = {a.question_id: a for a in resp.answers.all()}
            for q in questions:
                answer = answer_map.get(q.id)
                if answer:
                    val = answer.answer_value.get('value', '')
                    if isinstance(val, list):
                        row.append(sanitize_csv_value(', '.join(str(v) for v in val)))
                    else:
                        row.append(sanitize_csv_value(str(val)))
                else:
                    row.append('')
            writer.writerow(row)

        response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="survey_{survey.id}_responses.csv"'
        return response


def sanitize_csv_value(value):
    if isinstance(value, str) and value and value[0] in ('=', '+', '-', '@', '\t', '\r'):
        return "'" + value
    return value
