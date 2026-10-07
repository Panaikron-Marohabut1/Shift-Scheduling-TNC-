-- Extend selectable profiles without replacing existing users or scheduling data.
ALTER TABLE users DROP CONSTRAINT users_demo_order_check;
ALTER TABLE users ADD CONSTRAINT users_demo_order_check CHECK (demo_order BETWEEN 1 AND 9);
