from core.models import StatusHistory


def record_status_change(entity_type, entity_id, old_status, new_status, user_id, notes=None):
    if old_status == new_status:
        return None
    return StatusHistory.objects.create(
        entity_type=entity_type,
        entity_id=entity_id,
        old_status=old_status,
        new_status=new_status,
        changed_by_user_id=user_id,
        notes=notes,
    )
