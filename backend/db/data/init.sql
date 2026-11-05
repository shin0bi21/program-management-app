--
-- PostgreSQL database dump
--

\restrict mWZOCbe4UXDVOQGccIj3tcI1dI3wJSicFZbYVJ0vb7XDWRPb0yFt95FhC4vrgBs

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: session_types; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.session_types VALUES ('00000000-0000-4000-8000-000000000001', 'Regular');
INSERT INTO public.session_types VALUES ('00000000-0000-4000-8000-000000000002', 'Guest Speaker');
INSERT INTO public.session_types VALUES ('00000000-0000-4000-8000-000000000003', 'Field Trip');


--
-- Data for Name: user_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.user_permissions VALUES ('5e1c2b0c-48cc-4d33-b387-06e05d220565', 'read:youth_profiles', '2026-05-18 22:50:18.846808+00', '2026-05-18 22:50:18.846808+00', NULL, NULL);
INSERT INTO public.user_permissions VALUES ('83c05c0a-9c2f-4977-a63f-9e33ab718eed', 'write:youth_profiles', '2026-05-18 22:50:18.846808+00', '2026-05-18 22:50:18.846808+00', NULL, NULL);
INSERT INTO public.user_permissions VALUES ('74f5d1ea-658a-4daa-8586-0fa7dd19100c', 'read:schools', '2026-05-18 22:50:18.846808+00', '2026-05-18 22:50:18.846808+00', NULL, NULL);
INSERT INTO public.user_permissions VALUES ('b5454db5-c66b-4c08-a8cc-bd823d21083f', 'read:settings', '2026-05-18 22:50:18.846808+00', '2026-05-18 22:50:18.846808+00', NULL, NULL);
INSERT INTO public.user_permissions VALUES ('c274b6f1-31d2-4bb6-ace2-e3b7dfac7eb5', 'write:settings', '2026-05-18 22:50:18.846808+00', '2026-05-18 22:50:18.846808+00', NULL, NULL);
INSERT INTO public.user_permissions VALUES ('f098da5d-7c93-4ae3-920c-e768d36c4b2b', 'write:schools', '2026-05-21 04:40:36.199311+00', '2026-05-21 04:40:36.199311+00', NULL, NULL);
INSERT INTO public.user_permissions VALUES ('baaad4c9-71b3-403b-a349-f4909e84048c', 'read:accounts', '2026-07-21 10:38:57.054943+00', '2026-07-21 10:38:57.054943+00', NULL, NULL);
INSERT INTO public.user_permissions VALUES ('c35ad8ae-fc43-44a5-9914-2f8957d5e989', 'write:accounts', '2026-07-21 10:38:57.054943+00', '2026-07-21 10:38:57.054943+00', NULL, NULL);
INSERT INTO public.user_permissions VALUES ('b7c10a58-f99f-4392-aea0-74d20ccac3d6', 'read:outreach', '2026-07-21 10:38:57.08883+00', '2026-07-21 10:38:57.08883+00', NULL, NULL);
INSERT INTO public.user_permissions VALUES ('f637d7f9-a223-49f1-92e1-11815beca3cd', 'write:outreach', '2026-07-21 10:38:57.08883+00', '2026-07-21 10:38:57.08883+00', NULL, NULL);
INSERT INTO public.user_permissions VALUES ('ac8e6601-98d8-4718-94d8-c9e4039fbd0c', 'read:programs', '2026-07-21 23:50:27.113139+00', '2026-07-21 23:50:27.113139+00', NULL, NULL);
INSERT INTO public.user_permissions VALUES ('68390b8b-5bc9-4be5-956f-aa84e24e7189', 'write:programs', '2026-07-21 23:50:27.113139+00', '2026-07-21 23:50:27.113139+00', NULL, NULL);
INSERT INTO public.user_permissions VALUES ('6a5c1859-25d9-491c-8008-c726f08c02f0', 'read:attendance', '2026-07-24 22:53:12.683899+00', '2026-07-24 22:53:12.683899+00', NULL, NULL);
INSERT INTO public.user_permissions VALUES ('09a59938-9032-44cd-8b3b-909674a1d335', 'write:attendance', '2026-07-24 22:53:12.683899+00', '2026-07-24 22:53:12.683899+00', NULL, NULL);
INSERT INTO public.user_permissions VALUES ('97c00fac-b74c-4063-b4b8-528e52f92ac3', 'read:homepage', '2026-07-27 21:26:53.846271+00', '2026-07-27 21:26:53.846271+00', NULL, NULL);
INSERT INTO public.user_permissions VALUES ('4804e983-3180-4723-9969-dbe5fd358974', 'write:homepage', '2026-07-27 21:26:53.846271+00', '2026-07-27 21:26:53.846271+00', NULL, NULL);
INSERT INTO public.user_permissions VALUES ('04197a60-0665-45d2-8221-a951af150373', 'read:sessions', '2026-08-06 06:31:47.421219+00', '2026-08-06 06:31:47.421219+00', NULL, NULL);
INSERT INTO public.user_permissions VALUES ('95b336cf-ed2a-4976-989d-c1ac84c6a9bb', 'write:sessions', '2026-08-06 06:31:47.421219+00', '2026-08-06 06:31:47.421219+00', NULL, NULL);
INSERT INTO public.user_permissions VALUES ('024a2f68-a730-4161-b7a9-49c782c5df9e', 'read:tasks', '2026-08-11 06:11:14.466997+00', '2026-08-11 06:11:14.466997+00', NULL, NULL);
INSERT INTO public.user_permissions VALUES ('d17f930a-4dbc-423e-9041-d50906b3f39f', 'write:tasks', '2026-08-11 06:11:14.466997+00', '2026-08-11 06:11:14.466997+00', NULL, NULL);
INSERT INTO public.user_permissions VALUES ('f6f5464e-1e6d-41d5-aa9f-c154ef1ceb8a', 'read:hours', '2026-08-10 14:08:05.585638+00', '2026-08-10 14:08:05.585638+00', NULL, NULL);
INSERT INTO public.user_permissions VALUES ('c21cd811-4f98-4e4c-a719-be6dccc65628', 'write:hours', '2026-08-10 14:08:05.585638+00', '2026-08-10 14:08:05.585638+00', NULL, NULL);
INSERT INTO public.user_permissions VALUES ('23e92b95-e39f-4645-9a80-4f80a5bce1dc', 'write:enrollments', '2026-10-29 04:25:43.20804+00', '2026-10-29 04:25:43.20804+00', NULL, NULL);


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.user_roles VALUES ('dc8e3fe7-69df-4b15-815d-e6b81b0304c4', 'admin', '2026-05-18 22:50:18.846808+00', '2026-05-18 22:50:18.846808+00', NULL, NULL);
INSERT INTO public.user_roles VALUES ('19dccf1c-85f2-40fb-9b3b-2abf95669f4e', 'staff', '2026-05-18 22:50:18.846808+00', '2026-05-18 22:50:18.846808+00', NULL, NULL);
INSERT INTO public.user_roles VALUES ('752719e8-76d3-4411-b9bf-a12b75abf017', 'youth', '2026-05-18 22:50:18.846808+00', '2026-05-18 22:50:18.846808+00', NULL, NULL);
INSERT INTO public.user_roles VALUES ('5799be2a-a3c6-4185-8e1d-2a15bf59315a', 'project_manager', '2026-10-29 17:47:47.076196+00', '2026-10-29 17:47:47.076196+00', NULL, NULL);


--
-- Data for Name: user_role_has_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.user_role_has_permissions VALUES ('dc8e3fe7-69df-4b15-815d-e6b81b0304c4', '5e1c2b0c-48cc-4d33-b387-06e05d220565', '2026-05-18 22:50:18.846808+00', '2026-05-18 22:50:18.846808+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('dc8e3fe7-69df-4b15-815d-e6b81b0304c4', '83c05c0a-9c2f-4977-a63f-9e33ab718eed', '2026-05-18 22:50:18.846808+00', '2026-05-18 22:50:18.846808+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('dc8e3fe7-69df-4b15-815d-e6b81b0304c4', '74f5d1ea-658a-4daa-8586-0fa7dd19100c', '2026-05-18 22:50:18.846808+00', '2026-05-18 22:50:18.846808+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('dc8e3fe7-69df-4b15-815d-e6b81b0304c4', 'b5454db5-c66b-4c08-a8cc-bd823d21083f', '2026-05-18 22:50:18.846808+00', '2026-05-18 22:50:18.846808+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('dc8e3fe7-69df-4b15-815d-e6b81b0304c4', 'c274b6f1-31d2-4bb6-ace2-e3b7dfac7eb5', '2026-05-18 22:50:18.846808+00', '2026-05-18 22:50:18.846808+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('19dccf1c-85f2-40fb-9b3b-2abf95669f4e', '5e1c2b0c-48cc-4d33-b387-06e05d220565', '2026-05-18 22:50:18.846808+00', '2026-05-18 22:50:18.846808+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('19dccf1c-85f2-40fb-9b3b-2abf95669f4e', '83c05c0a-9c2f-4977-a63f-9e33ab718eed', '2026-05-18 22:50:18.846808+00', '2026-05-18 22:50:18.846808+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('19dccf1c-85f2-40fb-9b3b-2abf95669f4e', '74f5d1ea-658a-4daa-8586-0fa7dd19100c', '2026-05-18 22:50:18.846808+00', '2026-05-18 22:50:18.846808+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('dc8e3fe7-69df-4b15-815d-e6b81b0304c4', 'f098da5d-7c93-4ae3-920c-e768d36c4b2b', '2026-05-21 04:40:36.199311+00', '2026-05-21 04:40:36.199311+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('19dccf1c-85f2-40fb-9b3b-2abf95669f4e', 'f098da5d-7c93-4ae3-920c-e768d36c4b2b', '2026-05-21 04:40:36.199311+00', '2026-05-21 04:40:36.199311+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('19dccf1c-85f2-40fb-9b3b-2abf95669f4e', 'b5454db5-c66b-4c08-a8cc-bd823d21083f', '2026-07-01 00:15:33.886206+00', '2026-07-01 00:15:33.886206+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('19dccf1c-85f2-40fb-9b3b-2abf95669f4e', 'c274b6f1-31d2-4bb6-ace2-e3b7dfac7eb5', '2026-07-01 00:15:33.886206+00', '2026-07-01 00:15:33.886206+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('dc8e3fe7-69df-4b15-815d-e6b81b0304c4', 'baaad4c9-71b3-403b-a349-f4909e84048c', '2026-07-21 10:38:57.054943+00', '2026-07-21 10:38:57.054943+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('dc8e3fe7-69df-4b15-815d-e6b81b0304c4', 'c35ad8ae-fc43-44a5-9914-2f8957d5e989', '2026-07-21 10:38:57.054943+00', '2026-07-21 10:38:57.054943+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('19dccf1c-85f2-40fb-9b3b-2abf95669f4e', 'baaad4c9-71b3-403b-a349-f4909e84048c', '2026-07-21 10:38:57.054943+00', '2026-07-21 10:38:57.054943+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('19dccf1c-85f2-40fb-9b3b-2abf95669f4e', 'c35ad8ae-fc43-44a5-9914-2f8957d5e989', '2026-07-21 10:38:57.054943+00', '2026-07-21 10:38:57.054943+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('dc8e3fe7-69df-4b15-815d-e6b81b0304c4', 'b7c10a58-f99f-4392-aea0-74d20ccac3d6', '2026-07-21 10:38:57.08883+00', '2026-07-21 10:38:57.08883+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('dc8e3fe7-69df-4b15-815d-e6b81b0304c4', 'f637d7f9-a223-49f1-92e1-11815beca3cd', '2026-07-21 10:38:57.08883+00', '2026-07-21 10:38:57.08883+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('19dccf1c-85f2-40fb-9b3b-2abf95669f4e', 'b7c10a58-f99f-4392-aea0-74d20ccac3d6', '2026-07-21 10:38:57.08883+00', '2026-07-21 10:38:57.08883+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('19dccf1c-85f2-40fb-9b3b-2abf95669f4e', 'f637d7f9-a223-49f1-92e1-11815beca3cd', '2026-07-21 10:38:57.08883+00', '2026-07-21 10:38:57.08883+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('dc8e3fe7-69df-4b15-815d-e6b81b0304c4', 'ac8e6601-98d8-4718-94d8-c9e4039fbd0c', '2026-07-21 23:50:27.113139+00', '2026-07-21 23:50:27.113139+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('19dccf1c-85f2-40fb-9b3b-2abf95669f4e', 'ac8e6601-98d8-4718-94d8-c9e4039fbd0c', '2026-07-21 23:50:27.113139+00', '2026-07-21 23:50:27.113139+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('dc8e3fe7-69df-4b15-815d-e6b81b0304c4', '68390b8b-5bc9-4be5-956f-aa84e24e7189', '2026-07-21 23:50:27.113139+00', '2026-07-21 23:50:27.113139+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('dc8e3fe7-69df-4b15-815d-e6b81b0304c4', '6a5c1859-25d9-491c-8008-c726f08c02f0', '2026-07-24 22:53:12.683899+00', '2026-07-24 22:53:12.683899+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('19dccf1c-85f2-40fb-9b3b-2abf95669f4e', '6a5c1859-25d9-491c-8008-c726f08c02f0', '2026-07-24 22:53:12.683899+00', '2026-07-24 22:53:12.683899+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('dc8e3fe7-69df-4b15-815d-e6b81b0304c4', '09a59938-9032-44cd-8b3b-909674a1d335', '2026-07-24 22:53:12.683899+00', '2026-07-24 22:53:12.683899+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('19dccf1c-85f2-40fb-9b3b-2abf95669f4e', '09a59938-9032-44cd-8b3b-909674a1d335', '2026-07-24 22:53:12.683899+00', '2026-07-24 22:53:12.683899+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('dc8e3fe7-69df-4b15-815d-e6b81b0304c4', '97c00fac-b74c-4063-b4b8-528e52f92ac3', '2026-07-27 21:26:53.846271+00', '2026-07-27 21:26:53.846271+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('dc8e3fe7-69df-4b15-815d-e6b81b0304c4', '4804e983-3180-4723-9969-dbe5fd358974', '2026-07-27 21:26:53.846271+00', '2026-07-27 21:26:53.846271+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('19dccf1c-85f2-40fb-9b3b-2abf95669f4e', '97c00fac-b74c-4063-b4b8-528e52f92ac3', '2026-07-27 21:26:53.846271+00', '2026-07-27 21:26:53.846271+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('19dccf1c-85f2-40fb-9b3b-2abf95669f4e', '4804e983-3180-4723-9969-dbe5fd358974', '2026-07-27 21:26:53.846271+00', '2026-07-27 21:26:53.846271+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('dc8e3fe7-69df-4b15-815d-e6b81b0304c4', '04197a60-0665-45d2-8221-a951af150373', '2026-08-06 06:31:47.421219+00', '2026-08-06 06:31:47.421219+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('dc8e3fe7-69df-4b15-815d-e6b81b0304c4', '95b336cf-ed2a-4976-989d-c1ac84c6a9bb', '2026-08-06 06:31:47.421219+00', '2026-08-06 06:31:47.421219+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('19dccf1c-85f2-40fb-9b3b-2abf95669f4e', '04197a60-0665-45d2-8221-a951af150373', '2026-08-06 06:31:47.421219+00', '2026-08-06 06:31:47.421219+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('19dccf1c-85f2-40fb-9b3b-2abf95669f4e', '95b336cf-ed2a-4976-989d-c1ac84c6a9bb', '2026-08-06 06:31:47.421219+00', '2026-08-06 06:31:47.421219+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('dc8e3fe7-69df-4b15-815d-e6b81b0304c4', 'f6f5464e-1e6d-41d5-aa9f-c154ef1ceb8a', '2026-08-10 14:08:05.585638+00', '2026-08-10 14:08:05.585638+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('dc8e3fe7-69df-4b15-815d-e6b81b0304c4', 'c21cd811-4f98-4e4c-a719-be6dccc65628', '2026-08-10 14:08:05.585638+00', '2026-08-10 14:08:05.585638+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('19dccf1c-85f2-40fb-9b3b-2abf95669f4e', 'f6f5464e-1e6d-41d5-aa9f-c154ef1ceb8a', '2026-08-10 14:08:05.585638+00', '2026-08-10 14:08:05.585638+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('19dccf1c-85f2-40fb-9b3b-2abf95669f4e', 'c21cd811-4f98-4e4c-a719-be6dccc65628', '2026-08-10 14:08:05.585638+00', '2026-08-10 14:08:05.585638+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('dc8e3fe7-69df-4b15-815d-e6b81b0304c4', '024a2f68-a730-4161-b7a9-49c782c5df9e', '2026-08-11 06:11:14.466997+00', '2026-08-11 06:11:14.466997+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('dc8e3fe7-69df-4b15-815d-e6b81b0304c4', 'd17f930a-4dbc-423e-9041-d50906b3f39f', '2026-08-11 06:11:14.466997+00', '2026-08-11 06:11:14.466997+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('19dccf1c-85f2-40fb-9b3b-2abf95669f4e', '024a2f68-a730-4161-b7a9-49c782c5df9e', '2026-08-11 06:11:14.466997+00', '2026-08-11 06:11:14.466997+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('19dccf1c-85f2-40fb-9b3b-2abf95669f4e', 'd17f930a-4dbc-423e-9041-d50906b3f39f', '2026-08-11 06:11:14.466997+00', '2026-08-11 06:11:14.466997+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('dc8e3fe7-69df-4b15-815d-e6b81b0304c4', '23e92b95-e39f-4645-9a80-4f80a5bce1dc', '2026-10-29 04:25:43.20804+00', '2026-10-29 04:25:43.20804+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('19dccf1c-85f2-40fb-9b3b-2abf95669f4e', '23e92b95-e39f-4645-9a80-4f80a5bce1dc', '2026-10-29 04:25:43.20804+00', '2026-10-29 04:25:43.20804+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('5799be2a-a3c6-4185-8e1d-2a15bf59315a', '5e1c2b0c-48cc-4d33-b387-06e05d220565', '2026-10-29 17:47:47.076196+00', '2026-10-29 17:47:47.076196+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('5799be2a-a3c6-4185-8e1d-2a15bf59315a', '83c05c0a-9c2f-4977-a63f-9e33ab718eed', '2026-10-29 17:47:47.076196+00', '2026-10-29 17:47:47.076196+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('5799be2a-a3c6-4185-8e1d-2a15bf59315a', '74f5d1ea-658a-4daa-8586-0fa7dd19100c', '2026-10-29 17:47:47.076196+00', '2026-10-29 17:47:47.076196+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('5799be2a-a3c6-4185-8e1d-2a15bf59315a', 'f098da5d-7c93-4ae3-920c-e768d36c4b2b', '2026-10-29 17:47:47.076196+00', '2026-10-29 17:47:47.076196+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('5799be2a-a3c6-4185-8e1d-2a15bf59315a', 'b5454db5-c66b-4c08-a8cc-bd823d21083f', '2026-10-29 17:47:47.076196+00', '2026-10-29 17:47:47.076196+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('5799be2a-a3c6-4185-8e1d-2a15bf59315a', 'c274b6f1-31d2-4bb6-ace2-e3b7dfac7eb5', '2026-10-29 17:47:47.076196+00', '2026-10-29 17:47:47.076196+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('5799be2a-a3c6-4185-8e1d-2a15bf59315a', 'baaad4c9-71b3-403b-a349-f4909e84048c', '2026-10-29 17:47:47.076196+00', '2026-10-29 17:47:47.076196+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('5799be2a-a3c6-4185-8e1d-2a15bf59315a', 'c35ad8ae-fc43-44a5-9914-2f8957d5e989', '2026-10-29 17:47:47.076196+00', '2026-10-29 17:47:47.076196+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('5799be2a-a3c6-4185-8e1d-2a15bf59315a', 'b7c10a58-f99f-4392-aea0-74d20ccac3d6', '2026-10-29 17:47:47.076196+00', '2026-10-29 17:47:47.076196+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('5799be2a-a3c6-4185-8e1d-2a15bf59315a', 'f637d7f9-a223-49f1-92e1-11815beca3cd', '2026-10-29 17:47:47.076196+00', '2026-10-29 17:47:47.076196+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('5799be2a-a3c6-4185-8e1d-2a15bf59315a', 'ac8e6601-98d8-4718-94d8-c9e4039fbd0c', '2026-10-29 17:47:47.076196+00', '2026-10-29 17:47:47.076196+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('5799be2a-a3c6-4185-8e1d-2a15bf59315a', '6a5c1859-25d9-491c-8008-c726f08c02f0', '2026-10-29 17:47:47.076196+00', '2026-10-29 17:47:47.076196+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('5799be2a-a3c6-4185-8e1d-2a15bf59315a', '09a59938-9032-44cd-8b3b-909674a1d335', '2026-10-29 17:47:47.076196+00', '2026-10-29 17:47:47.076196+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('5799be2a-a3c6-4185-8e1d-2a15bf59315a', '97c00fac-b74c-4063-b4b8-528e52f92ac3', '2026-10-29 17:47:47.076196+00', '2026-10-29 17:47:47.076196+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('5799be2a-a3c6-4185-8e1d-2a15bf59315a', '4804e983-3180-4723-9969-dbe5fd358974', '2026-10-29 17:47:47.076196+00', '2026-10-29 17:47:47.076196+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('5799be2a-a3c6-4185-8e1d-2a15bf59315a', '04197a60-0665-45d2-8221-a951af150373', '2026-10-29 17:47:47.076196+00', '2026-10-29 17:47:47.076196+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('5799be2a-a3c6-4185-8e1d-2a15bf59315a', '95b336cf-ed2a-4976-989d-c1ac84c6a9bb', '2026-10-29 17:47:47.076196+00', '2026-10-29 17:47:47.076196+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('5799be2a-a3c6-4185-8e1d-2a15bf59315a', 'f6f5464e-1e6d-41d5-aa9f-c154ef1ceb8a', '2026-10-29 17:47:47.076196+00', '2026-10-29 17:47:47.076196+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('5799be2a-a3c6-4185-8e1d-2a15bf59315a', 'c21cd811-4f98-4e4c-a719-be6dccc65628', '2026-10-29 17:47:47.076196+00', '2026-10-29 17:47:47.076196+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('5799be2a-a3c6-4185-8e1d-2a15bf59315a', '024a2f68-a730-4161-b7a9-49c782c5df9e', '2026-10-29 17:47:47.076196+00', '2026-10-29 17:47:47.076196+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('5799be2a-a3c6-4185-8e1d-2a15bf59315a', 'd17f930a-4dbc-423e-9041-d50906b3f39f', '2026-10-29 17:47:47.076196+00', '2026-10-29 17:47:47.076196+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('5799be2a-a3c6-4185-8e1d-2a15bf59315a', '23e92b95-e39f-4645-9a80-4f80a5bce1dc', '2026-10-29 17:47:47.076196+00', '2026-10-29 17:47:47.076196+00', NULL, NULL);
INSERT INTO public.user_role_has_permissions VALUES ('5799be2a-a3c6-4185-8e1d-2a15bf59315a', '68390b8b-5bc9-4be5-956f-aa84e24e7189', '2026-10-29 17:47:47.076196+00', '2026-10-29 17:47:47.076196+00', NULL, NULL);


--
-- PostgreSQL database dump complete
--

\unrestrict mWZOCbe4UXDVOQGccIj3tcI1dI3wJSicFZbYVJ0vb7XDWRPb0yFt95FhC4vrgBs

