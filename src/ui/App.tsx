import { greetingFor } from '../domain/greeting';

// Placeholder screen: replace it with the app's first screen (BOOTSTRAP.md).
export function App() {
  return (
    <main className="app">
      <h1>Nome do app</h1>
      <p>{greetingFor(new Date())}</p>
    </main>
  );
}
