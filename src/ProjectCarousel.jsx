import { useId } from 'react';
import { useCarousel } from './useCarousel.js';

function ProjectCard({ project, hidden, position }) {
  return (
    <article
      className="project"
      data-carousel-slide=""
      hidden={hidden}
      aria-roledescription={position ? 'slide' : undefined}
      aria-label={position}
    >
      <img className="project__cover" {...project.cover} />
      <div className="project__body">
        <div>
          <span className="project__category">{project.category}</span>
          <h3 lang={project.titleLanguage}>{project.title}</h3>
          <p>{project.description}</p>
        </div>
        <a className="project__link" href={project.url}>
          {project.linkLabel} <span aria-hidden="true">↗</span>
        </a>
      </div>
    </article>
  );
}

function CarouselArrow({ label, path, onClick }) {
  return (
    <button className="carousel__arrow" type="button" aria-label={label} onClick={onClick}>
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export default function ProjectCarousel({ projects, intervalMs }) {
  const heading = useId();
  const {
    rootRef, viewportRef, activeIndex, announcedIndex, interactive, interval, playing, pause, select, toggleRotation,
  } = useCarousel(projects.length, intervalMs);
  const position = (index) => `${index + 1} of ${projects.length}`;
  const announcedProject = projects[announcedIndex];

  function handleFocus({ target }) {
    // Don't change the Pause button's action between pointer-down and click.
    if (!target.hasAttribute('data-rotation-toggle') || target.matches(':focus-visible')) pause();
  }

  function handleNavigationKey(event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    select(activeIndex + (event.key === 'ArrowLeft' ? -1 : 1));
  }

  return (
    <section
      className={interactive ? 'carousel carousel--enhanced' : 'carousel'}
      aria-labelledby={heading}
      aria-roledescription={interactive ? 'carousel' : undefined}
      data-carousel=""
      data-interval={interval}
      ref={rootRef}
      onFocus={handleFocus}
    >
      <div className="carousel__header">
        <h2 id={heading}>Projects</h2>
        {interactive && (
          <button className="carousel__toggle" type="button" data-rotation-toggle="" onClick={toggleRotation}>
            {playing ? 'Pause autoplay' : 'Start autoplay'}
          </button>
        )}
      </div>
      <div className="carousel__viewport" ref={viewportRef}>
        {interactive && (
          <div className="carousel__arrows" onKeyDown={handleNavigationKey}>
            <CarouselArrow label="Previous project" path="m15 6-6 6 6 6" onClick={() => select(activeIndex - 1)} />
            <CarouselArrow label="Next project" path="m9 6 6 6-6 6" onClick={() => select(activeIndex + 1)} />
          </div>
        )}
        {projects.map((project, index) => (
          <ProjectCard
            key={project.id}
            project={project}
            hidden={interactive && index !== activeIndex}
            position={interactive ? position(index) : undefined}
          />
        ))}
      </div>
      {interactive && (
        <div className="carousel__picker" role="group" aria-label="Choose a project" onKeyDown={handleNavigationKey}>
          {projects.map((project, index) => (
            <button
              key={project.id}
              type="button"
              lang={project.titleLanguage}
              aria-current={index === activeIndex ? 'true' : undefined}
              onClick={() => select(index)}
            >
              {project.title}
            </button>
          ))}
        </div>
      )}
      <p className="visually-hidden" role="status">
        {interactive && announcedProject && `${announcedProject.title} (${position(announcedIndex)})`}
      </p>
    </section>
  );
}
