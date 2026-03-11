-- commission_students
ALTER TABLE commission_students ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE commission_students ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE commission_students ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
ALTER TABLE commission_students ADD COLUMN IF NOT EXISTS updated_by_user_id INTEGER;
ALTER TABLE commission_students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE commission_students ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE commission_students ADD COLUMN IF NOT EXISTS total_received DECIMAL(14,2) DEFAULT 0;
ALTER TABLE commission_students ADD COLUMN IF NOT EXISTS course_name VARCHAR(500);
ALTER TABLE commission_students ADD COLUMN IF NOT EXISTS course_duration_years DECIMAL(4,1);
ALTER TABLE commission_students ADD COLUMN IF NOT EXISTS commission_rate_pct DECIMAL(8,4);
ALTER TABLE commission_students ADD COLUMN IF NOT EXISTS gst_rate_pct DECIMAL(5,2) DEFAULT 10;
ALTER TABLE commission_students ADD COLUMN IF NOT EXISTS gst_applicable VARCHAR(3) DEFAULT 'Yes';
ALTER TABLE commission_students ADD COLUMN IF NOT EXISTS scholarship_type VARCHAR(16) DEFAULT 'None';
ALTER TABLE commission_students ADD COLUMN IF NOT EXISTS scholarship_value DECIMAL(12,2) DEFAULT 0;

-- commission_entries
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS updated_by_user_id INTEGER;
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS student_provider_id INTEGER;
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS academic_year VARCHAR(16);
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS commission_rate_auto DECIMAL(8,4);
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS commission_rate_override_pct DECIMAL(8,4);
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS commission_rate_used_pct DECIMAL(8,4);
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS bonus DECIMAL(12,2) DEFAULT 0;
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS student_status VARCHAR(32) DEFAULT 'Under Enquiry';
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS rate_change_warning VARCHAR(128);
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS scholarship_type_auto VARCHAR(16);
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS scholarship_value_auto DECIMAL(12,2);
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS scholarship_type_override VARCHAR(16);
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS scholarship_value_override DECIMAL(12,2);
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS scholarship_type_used VARCHAR(16);
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS scholarship_value_used DECIMAL(12,2);
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS scholarship_change_warning VARCHAR(128);
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS scholarship_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE commission_entries ADD COLUMN IF NOT EXISTS fee_after_scholarship DECIMAL(12,2) DEFAULT 0;

-- sub_agent_entries
ALTER TABLE sub_agent_entries ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE sub_agent_entries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- sub_agent_term_entries
ALTER TABLE sub_agent_term_entries ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE sub_agent_term_entries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- agreements
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS confidentiality_level VARCHAR(16) DEFAULT 'high';
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS updated_by_user_id INTEGER;

-- agreement_documents
ALTER TABLE agreement_documents ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE agreement_documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE agreement_documents ADD COLUMN IF NOT EXISTS updated_by_user_id INTEGER;

-- agreement_contacts
ALTER TABLE agreement_contacts ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
ALTER TABLE agreement_contacts ADD COLUMN IF NOT EXISTS updated_by_user_id INTEGER;

-- create missing tables
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

-- users
ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- user_devices
CREATE TABLE IF NOT EXISTS user_devices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    fingerprint VARCHAR(64) NOT NULL,
    device_name VARCHAR(255),
    browser VARCHAR(128),
    os VARCHAR(64),
    ip_address VARCHAR(45),
    location VARCHAR(255),
    first_login TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP DEFAULT NOW(),
    is_trusted BOOLEAN DEFAULT true
);
