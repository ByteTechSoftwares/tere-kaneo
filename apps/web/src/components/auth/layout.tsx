import { Logo } from "../common/logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";

type AuthLayoutProps = {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
};

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="h-svh w-full overflow-y-auto bg-background flex flex-col items-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-sm space-y-4 my-auto">
        {/* Mascot (D-42, 02.1-05): supplements, does not replace, the
            wordmark below. Fixed dark tile per docs/brand-kit.md — the
            mascot's body has no background of its own and needs a
            constant dark ground in both themes. */}
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[#141414]">
          <img
            src="/anota-mascot.svg"
            alt=""
            aria-hidden="true"
            className="size-11"
          />
        </div>
        <Logo className="mx-auto flex w-full items-end justify-center" />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{title}</CardTitle>
            {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
          </CardHeader>
          <CardContent className="pt-0">{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
