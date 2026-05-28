-- [study] [all tenants] — AI persona customisation (name + avatar)
ALTER TABLE study_config ADD COLUMN ai_name TEXT;
ALTER TABLE study_config ADD COLUMN ai_avatar TEXT;
