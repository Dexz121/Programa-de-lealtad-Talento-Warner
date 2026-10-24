import { options, requireEvaluationToken } from "@/lib/evaluation-api";

export function OPTIONS() {
  return options();
}

export function GET(request: Request) {
  return requireEvaluationToken(request);
}
