import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqAccordionProps {
  items: FaqItem[];
}

const FaqAccordion = ({ items }: FaqAccordionProps) => (
  <Accordion type="single" collapsible className="w-full">
    {items.map((item, i) => (
      <AccordionItem key={i} value={`item-${i}`} className="border-border">
        <AccordionTrigger className="font-display text-lg text-left hover:no-underline hover:text-primary-strong py-5">
          {item.question}
        </AccordionTrigger>
        <AccordionContent className="text-sm text-muted-foreground font-body leading-relaxed pb-5">
          {item.answer}
        </AccordionContent>
      </AccordionItem>
    ))}
  </Accordion>
);

export default FaqAccordion;
