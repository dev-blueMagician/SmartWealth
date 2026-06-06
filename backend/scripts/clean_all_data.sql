-- Xóa toàn bộ dữ liệu nghiệp vụ để test lại (giữ bảng migration Flyway).
-- Chạy trong schema smartwealth (khớp application.yml: currentSchema=smartwealth).

SET search_path TO smartwealth;

TRUNCATE TABLE
    audit_event,
    client
RESTART IDENTITY CASCADE;

-- CASCADE sẽ xóa dữ liệu các bảng phụ thuộc: "case", task, asset, goal,
-- financial_plan, recommendation, decision, portfolio, portfolio_allocation,
-- execution_instruction.
