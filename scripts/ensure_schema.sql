ALTER TABLE commission_students ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE commission_students ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE student_providers ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE student_providers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE sub_agent_entries ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE sub_agent_entries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE sub_agent_term_entries ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE sub_agent_term_entries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE agreement_documents ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE agreement_documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE agreement_documents ADD COLUMN IF NOT EXISTS updated_by_user_id INTEGER;
ALTER TABLE agreement_contacts ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
ALTER TABLE agreement_contacts ADD COLUMN IF NOT EXISTS updated_by_user_id INTEGER;

CREATE TABLE IF NOT EXISTS student_providers (
    id SERIAL PRIMARY KEY,
    commission_student_id INTEGER NOT NULL,
    provider VARCHAR(255) NOT NULL,
    student_id VARCHAR(64),
    country VARCHAR(64) DEFAULT 'Australia',
    course_level VARCHAR(64),
    course_name VARCHAR(500),
    course_duration_years DECIMAL(4,1),
    start_intake VARCHAR(32),
    commission_rate_pct DECIMAL(8,4),
    gst_rate_pct DECIMAL(5,2) DEFAULT 10,
    gst_applicable VARCHAR(3) DEFAULT 'Yes',
    scholarship_type VARCHAR(16) DEFAULT 'None',
    scholarship_value DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(32) DEFAULT 'Under Enquiry',
    notes TEXT,
    created_by_user_id INTEGER,
    updated_by_user_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS status_history (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(32) NOT NULL,
    entity_id INTEGER NOT NULL,
    old_status VARCHAR(32),
    new_status VARCHAR(32) NOT NULL,
    changed_by_user_id INTEGER,
    changed_at TIMESTAMP DEFAULT NOW(),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS email_templates (
    id SERIAL PRIMARY KEY,
    template_key VARCHAR(128) UNIQUE NOT NULL,
    name VARCHAR(255) DEFAULT '',
    subject VARCHAR(512) NOT NULL,
    html_body TEXT NOT NULL DEFAULT '',
    plain_body TEXT,
    variables TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by_user_id INTEGER,
    updated_by_user_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
