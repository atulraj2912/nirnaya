import Card, { CardHeader, CardContent } from "@/components/ui/card";
import Input from "@/components/ui/input";
import Button from "@/components/ui/button";

export const metadata = {
  title: "Sign In — NIRNAYA",
};

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-lg font-bold text-white">
            N
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text">NIRNAYA</h1>
            <p className="text-sm text-text-muted">
              Enterprise IT Service Management
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4">
          <Input label="Email" type="email" placeholder="you@company.com" disabled />
          <Input label="Password" type="password" placeholder="Enter your password" disabled />
          <Button disabled className="w-full">
            Sign In
          </Button>
          <p className="text-center text-xs text-text-muted">
            Authentication will be implemented in Phase 3.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
