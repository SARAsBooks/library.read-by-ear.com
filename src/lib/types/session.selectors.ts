import type { Session } from "@/lib/types/session";
import { fromNullable, type Option } from "@/lib/types/option";

export const getStudentIdOpt = (s: Session): Option<string> =>
  fromNullable(s.studentId);
