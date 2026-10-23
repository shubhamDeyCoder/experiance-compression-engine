ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "service_role";

CREATE TABLE "public"."competencies" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"        text                     NOT NULL,
  "description" text                     NOT NULL,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "competencies_name_key" UNIQUE (name),
  CONSTRAINT "competencies_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."competencies"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."expert_cases" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "title"         text                     NOT NULL,
  "domain"        text                     NOT NULL,
  "difficulty"    text                     NOT NULL DEFAULT 'Intermediate'::text,
  "situation"     text                     NOT NULL,
  "question"      text                     NOT NULL,
  "competency_id" uuid,
  "options"       jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "is_approved"   boolean                  NOT NULL DEFAULT false,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "expert_cases_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."expert_cases"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."learner_attempts" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "learner_id"      uuid                     NOT NULL,
  "case_id"         uuid                     NOT NULL,
  "selected_option" integer                  NOT NULL,
  "score"           integer                  NOT NULL,
  "feedback"        text                     NOT NULL DEFAULT ''::text,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "learner_attempts_pkey" PRIMARY KEY (id),
  CONSTRAINT "learner_attempts_score_check" CHECK (((score >= 0) AND (score <= 100)))
);

ALTER TABLE "public"."learner_attempts"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."mentor_reviews" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "attempt_id" uuid                     NOT NULL,
  "mentor_id"  uuid                     NOT NULL,
  "comments"   text                     NOT NULL,
  "approved"   boolean                  NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "mentor_reviews_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."mentor_reviews"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."expert_cases"
  ADD CONSTRAINT "expert_cases_competency_id_fkey" FOREIGN KEY (competency_id) REFERENCES public.competencies(id);

ALTER TABLE "public"."learner_attempts"
  ADD CONSTRAINT "learner_attempts_case_id_fkey" FOREIGN KEY (case_id) REFERENCES public.expert_cases(id);

ALTER TABLE "public"."learner_attempts"
  ADD CONSTRAINT "learner_attempts_learner_id_fkey" FOREIGN KEY (learner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."mentor_reviews"
  ADD CONSTRAINT "mentor_reviews_attempt_id_fkey" FOREIGN KEY (attempt_id) REFERENCES public.learner_attempts(id) ON DELETE CASCADE;

ALTER TABLE "public"."mentor_reviews"
  ADD CONSTRAINT "mentor_reviews_mentor_id_fkey" FOREIGN KEY (mentor_id) REFERENCES auth.users(id);

CREATE POLICY "Authenticated users can read competencies" ON "public"."competencies"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "Authenticated users can read approved cases" ON "public"."expert_cases"
  FOR SELECT
  TO "authenticated"
  USING ((is_approved = true));

CREATE POLICY "Learners can create their own attempts" ON "public"."learner_attempts"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT auth.uid() AS uid) = learner_id));

CREATE POLICY "Learners can insert their own attempts" ON "public"."learner_attempts"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((learner_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Learners can read their own attempts" ON "public"."learner_attempts"
  FOR SELECT
  TO "authenticated"
  USING ((learner_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Learners can read reviews of their attempts" ON "public"."mentor_reviews"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.learner_attempts a
  WHERE ((a.id = mentor_reviews.attempt_id) AND (a.learner_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "Mentors can read their own reviews" ON "public"."mentor_reviews"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT auth.uid() AS uid) = mentor_id));

REVOKE ALL ON TABLE "public"."competencies" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."competencies" TO "anon";

REVOKE ALL ON TABLE "public"."competencies" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."competencies" TO "authenticated";

REVOKE ALL ON TABLE "public"."competencies" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."competencies" TO "postgres";

REVOKE ALL ON TABLE "public"."competencies" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."competencies" TO "service_role";

REVOKE ALL ON TABLE "public"."expert_cases" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."expert_cases" TO "anon";

REVOKE ALL ON TABLE "public"."expert_cases" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."expert_cases" TO "authenticated";

REVOKE ALL ON TABLE "public"."expert_cases" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."expert_cases" TO "postgres";

REVOKE ALL ON TABLE "public"."expert_cases" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."expert_cases" TO "service_role";

REVOKE ALL ON TABLE "public"."learner_attempts" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."learner_attempts" TO "anon";

REVOKE ALL ON TABLE "public"."learner_attempts" FROM "authenticated";

GRANT INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."learner_attempts" TO "authenticated";

REVOKE ALL ON TABLE "public"."learner_attempts" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."learner_attempts" TO "postgres";

REVOKE ALL ON TABLE "public"."learner_attempts" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."learner_attempts" TO "service_role";

REVOKE ALL ON TABLE "public"."mentor_reviews" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."mentor_reviews" TO "anon";

REVOKE ALL ON TABLE "public"."mentor_reviews" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."mentor_reviews" TO "authenticated";

REVOKE ALL ON TABLE "public"."mentor_reviews" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."mentor_reviews" TO "postgres";

REVOKE ALL ON TABLE "public"."mentor_reviews" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."mentor_reviews" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES TO "service_role";

