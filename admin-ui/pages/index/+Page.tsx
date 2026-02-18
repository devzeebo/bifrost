import { Counter } from "@/components/Counter";

export const Page = () => (
  <>
    <h1>My Vike app</h1>
    <p>This page is:</p>
    <ul>
      <li>Rendered to HTML.</li>
      <li>
        Interactive. <Counter />
      </li>
    </ul>
  </>
);
