ALTER TABLE services
  ADD COLUMN title_en text NOT NULL DEFAULT '',
  ADD COLUMN title_ru text NOT NULL DEFAULT '',
  ADD COLUMN description_en text NOT NULL DEFAULT '',
  ADD COLUMN description_ru text NOT NULL DEFAULT '';

ALTER TABLE faqs
  ADD COLUMN question_en text NOT NULL DEFAULT '',
  ADD COLUMN question_ru text NOT NULL DEFAULT '',
  ADD COLUMN answer_en text NOT NULL DEFAULT '',
  ADD COLUMN answer_ru text NOT NULL DEFAULT '';

ALTER TABLE testimonials
  ADD COLUMN quote_en text NOT NULL DEFAULT '',
  ADD COLUMN quote_ru text NOT NULL DEFAULT '';

ALTER TABLE blog_posts
  ADD COLUMN title_en text NOT NULL DEFAULT '',
  ADD COLUMN title_ru text NOT NULL DEFAULT '',
  ADD COLUMN content_en text NOT NULL DEFAULT '',
  ADD COLUMN content_ru text NOT NULL DEFAULT '',
  ADD COLUMN meta_description_en text NOT NULL DEFAULT '',
  ADD COLUMN meta_description_ru text NOT NULL DEFAULT '';