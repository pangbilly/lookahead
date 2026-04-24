import { Button } from '@/components/ui/button';
import { loginWithGoogle } from '@/actions/auth';

export function GoogleButton() {
  return (
    <form action={loginWithGoogle}>
      <Button type="submit" variant="outlined" size="lg" className="w-full">
        Continue with Google
      </Button>
    </form>
  );
}
