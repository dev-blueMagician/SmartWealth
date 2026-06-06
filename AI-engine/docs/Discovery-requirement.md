# Discovery Layer - Technical Requirements

## 1. Database Schema (Schema: `smartwealth`)

### 1.1. Câu hỏi khảo sát (Question Definition)
```sql
CREATE TABLE smartwealth.question_definition (
  question_id      VARCHAR(32) PRIMARY KEY,
  module           VARCHAR(100),
  section          VARCHAR(100),
  question_text    TEXT,
  answer_type      VARCHAR(50),         -- text, number, choice, block
  is_repeatable    BOOLEAN DEFAULT false,
  required_flag    BOOLEAN,
  conditional_flag BOOLEAN,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE smartwealth.question_option (
  id              UUID PRIMARY KEY DEFAULT gen_random(question_id)  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
);
  question_id     VARCHAR(32),
  option_value    VARCHAR(100),
  option_label    VARCHAR(200),
  CONSTRAINT fk_q_option FOREIGN KEY (question_id)

CREATE TABLE smartwealth.question_answer (
  id             UUID PRIMARY KEY DEFAULT_answer_case  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    FOREIGN KEY (case_id) REFERENCES smartwealth.case(id),
  CONSTRAINT fk_q_answer_def
    FOREIGN KEY (question_id) REFERENCES smartwealth.question_definition(question_id)
);
  case_id        UUID NOT NULL,
  question_id    VARCHAR(32) NOT NULL,
  block_index    INT DEFAULT 0,
  answer_value   JSONB,
  created_at     TIMESTAMPTZ DEFAULT now(),

CREATE TABLE smartwealth.question_field_mapping (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     VARCHAR(32) NOT NULL,
  system_field    VARCHAR(200) NOT NULL,
  entity_type     VARCHAR(50),
  transform_type  VARCHAR(50),
  created_at      TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_q_map_question
    FOREIGN KEY (question_id) REFERENCES smartwealth.question_definition(question_id)
);
``
2. API Specification (CRUD Endpoints)
2.1. Question APIs

GET /questions

Lấy danh sách câu hỏi, filter theo module hoặc section (optional).


POST /questions

Tạo mới câu hỏi.


PUT /questions/{question_id}

Cập nhật câu hỏi.


DELETE /questions/{question_id}

Xóa câu hỏi.



2.2. Option APIs

GET /questions/{question_id}/options

Lấy các lựa chọn cho câu hỏi enum/multi-select.


POST /questions/{question_id}/options

Thêm lựa chọn mới.



2.3. Answer APIs

GET /answers?case_id={case_id}

Lấy tất cả câu trả lời của một case.


POST /answers

Gửi đáp án mới.
Body mẫu:

JSON{  "case_id": "uuid-case",  "question_id": "Q042",  "block_index": 0,  "answer_value": 200000}



2.4. Mapping APIs

GET /mappings

Lấy tất cả mapping QID → system_field.


POST /mappings

Thêm mapping mới.


PUT /mappings/{id}

Sửa mapping.


DELETE /mappings/{id}

Xóa mapping.




3. UI/UX Requirements
3.1. Màn hình nhập liệu (Dynamic Questionnaire)

Render form động theo kết quả /questions

Hỗ trợ các input: text, number, select, block lặp lại (repeatable).
Nếu là enum/multi-select: load options từ /questions/{question_id}/options.


Khi user nhập câu trả lời: Gọi POST /answers.
Progress Bar: Hiển thị tỷ lệ hoàn thiện câu hỏi bắt buộc.
Hỗ trợ block (thêm/xóa dòng với khối lặp).
Sidebar hoặc inline hiển thị suggestion/gợi ý từ Cursor AI.
Highlight các trường missing/required chưa được trả lời.

3.2. Màn hình quản lý Mapping

Table liệt kê: QID, system_field, entity_type, transform_type.
Chức năng thêm/sửa/xóa mapping.
Search/filter theo module hoặc QID.


4. Yêu cầu tích hợp Cursor AI

Suggest trả lời hoặc auto-fill dựa trên context hiện tại và các đáp án đã nhập.
Suggest mapping tự động khi nhập câu hỏi mới (nếu có).
Hiển thị giải thích ý nghĩa, hướng dẫn sử dụng từng câu hỏi (nếu cần).
Đề xuất/gợi ý khi user còn bỏ sót trường bắt buộc.


5. Quy ước kỹ thuật & Best Practices

Dùng schema smartwealth, không cần schema riêng cho discovery layer.
Dùng UUID hoặc VARCHAR(32) cho khóa chính, đồng bộ cách đặt tên trường (snake_case, lower).
API sử dụng định dạng RESTful JSON, trả về HTTP status code + message rõ ràng.
Validate dữ liệu đầu vào ở cả backend và frontend.


6. Phụ lục - Chuẩn JSON trao đổi
Mẫu trả lời POST /answers

{
  "case_id": "0ed8a6ea-...-4bcf",
  "question_id": "Q044",
  "block_index": 1,
  "answer_value": 2035
}
