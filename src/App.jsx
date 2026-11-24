import ProjectCarousel from './ProjectCarousel.jsx';
import { projects, rotationIntervalMs } from './projects.js';

export default function App() {
  return (
    <>
      <header className="home__intro">
        <span className="label">Hello, internet</span>
        <h1>Adrian Moroz<span>.</span></h1>
        <p>A home for the things I build on the web. Pick a project below to try it.</p>
      </header>
      <ProjectCarousel projects={projects} intervalMs={rotationIntervalMs} />
      <a className="home__support-link" href="https://paypal.me/adrianmoroz1999">
        Buy me a coffee
      </a>
    </>
  );
}
