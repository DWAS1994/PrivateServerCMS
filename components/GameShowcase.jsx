const SHOWCASE = [
  {
    src: "/theme/ingame-hotan.jpg",
    fallback: "/theme/fallback-hotan.svg",
    title: "Hotan trade routes",
    eyebrow: "Trader · Hunter · Thief",
    text: "Show real caravan screenshots, fortress staging, or city life here.",
  },
  {
    src: "/theme/ingame-unique.jpg",
    fallback: "/theme/fallback-unique.svg",
    title: "Unique boss hunts",
    eyebrow: "Tiger Girl · Isyutaru · Lord Yarkan",
    text: "Perfect slot for unique kills, party screenshots, and rare drops.",
  },
  {
    src: "/theme/ingame-jobwar.jpg",
    fallback: "/theme/fallback-jobwar.svg",
    title: "Job wars & PvP",
    eyebrow: "Fortress · Arena · Cape fights",
    text: "Use action-heavy in-game screenshots to make the server feel alive.",
  },
];

function handleImageError(event, fallback) {
  if (event.currentTarget.dataset.fallbackApplied === "true") return;
  event.currentTarget.dataset.fallbackApplied = "true";
  event.currentTarget.src = fallback;
}

export default function GameShowcase() {
  return (
    <section className="game-showcase" aria-labelledby="showcase-title">
      <div className="showcase-heading">
        <div>
          <div className="kicker">Silkroad world preview</div>
          <h2 id="showcase-title" className="section-title">Built around real in-game moments</h2>
        </div>
        <p>
          Replace these slots with your own Silkroad Online screenshots in <code>/public/theme</code>.
          The layout already expects city, unique-boss, and job-war imagery.
        </p>
      </div>

      <div className="showcase-grid">
        {SHOWCASE.map((item) => (
          <article className="showcase-card" key={item.src}>
            <div className="showcase-image-wrap">
              <img
                className="showcase-image"
                src={item.src}
                alt={item.title}
                onError={(event) => handleImageError(event, item.fallback)}
              />
              <div className="showcase-sheen" />
            </div>
            <div className="showcase-copy">
              <span className="showcase-eyebrow">{item.eyebrow}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
