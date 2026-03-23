interface TestimonialCardProps {
  quote: string;
  name: string;
}

const TestimonialCard = ({ quote, name }: TestimonialCardProps) => (
  <div className="bg-card rounded border border-border p-6 md:p-8 shadow-card">
    <p className="text-sm text-muted-foreground font-body leading-relaxed italic mb-4">"{quote}"</p>
    <p className="text-sm font-body font-medium text-foreground">— {name}</p>
  </div>
);

export default TestimonialCard;
