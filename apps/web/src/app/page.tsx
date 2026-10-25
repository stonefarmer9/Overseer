import { Card, CardContent, CardHeader, CardTitle } from '@warmaster/ui';

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Warmaster</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Clean slate. Start building here.</p>
        </CardContent>
      </Card>
    </main>
  );
}
