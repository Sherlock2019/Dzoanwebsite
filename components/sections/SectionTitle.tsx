export default function SectionTitle({ id, title, intro }: { id: string; title: string; intro?: string }) {
  return (
    <div className="section-title">
      <h2 id={`${id}-title`}>{title}</h2>
      {intro && <p>{intro}</p>}
    </div>
  );
}
