import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { disabled } = await searchParams;
  return <LoginForm disabled={disabled === "1"} />;
}
