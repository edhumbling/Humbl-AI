import { StackHandler } from "@stackframe/stack"; 
import { stackServerApp } from "../../../stack/server"; 
import TermsNotice from "@/components/TermsNotice";

export default function Handler(props: unknown) { 
  return (
    <div className="relative min-h-screen">
      <StackHandler fullPage app={stackServerApp} routeProps={props} />
      <TermsNotice />
    </div>
  );
} 
