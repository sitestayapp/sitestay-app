import { Button } from "@/components/ui/button";
import { Users, Briefcase, Settings2, MapPin } from "lucide-react";

export type CarOption = {
  id?: string;
  model: string;
  group?: string | null;
  company?: string | null;
  company_logo?: string | null;
  photo?: string | null;
  seats?: number | null;
  transmission?: string | null;
  bags?: number | null;
  rating?: number | null;
  price_per_day?: number | null;
  price_total?: number | null;
  currency?: string;
  pick_up_date?: string;
  drop_off_date?: string;
  location?: string;
  url?: string | null;
};

export default function CarCard({
  option, index, onChoose, disabled,
}: { option: CarOption; index: number; onChoose: (o: CarOption, i: number) => void; disabled?: boolean }) {
  return (
    <div className="group flex flex-col sm:flex-row overflow-hidden rounded-2xl border border-border bg-card shadow-soft hover:shadow-elegant transition-all">
      <div className="sm:w-48 sm:shrink-0 h-40 sm:h-auto bg-secondary relative flex items-center justify-center">
        {option.photo ? (
          <img src={option.photo} alt={option.model} loading="lazy" className="h-full w-full object-contain p-3 group-hover:scale-105 transition-transform" />
        ) : (
          <div className="text-muted-foreground text-xs">Sin foto</div>
        )}
        <span className="absolute top-2 left-2 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full text-white bg-primary">COCHE</span>
      </div>
      <div className="flex-1 p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="font-display font-semibold text-base leading-tight truncate">{option.model}</h4>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              {option.company && <span className="font-medium">{option.company}</span>}
              {option.location && <><MapPin className="h-3 w-3 ml-1" /><span className="truncate">{option.location}</span></>}
            </p>
          </div>
          <div className="text-right shrink-0">
            {option.price_per_day != null ? (
              <>
                <div className="font-display text-lg font-bold text-primary leading-none">{Math.round(option.price_per_day)} €</div>
                <div className="text-[11px] text-muted-foreground">/ día</div>
                {option.price_total != null && <div className="text-[11px] text-muted-foreground mt-1">Total {Math.round(option.price_total)} €</div>}
              </>
            ) : <div className="text-xs text-muted-foreground">Bajo consulta</div>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {option.group && <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">{option.group}</span>}
          {option.seats != null && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted"><Users className="h-3 w-3" />{option.seats}</span>}
          {option.bags != null && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted"><Briefcase className="h-3 w-3" />{option.bags}</span>}
          {option.transmission && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted"><Settings2 className="h-3 w-3" />{option.transmission}</span>}
        </div>
        <div className="mt-auto pt-2 flex items-center justify-end">
          <Button size="sm" disabled={disabled} onClick={() => onChoose(option, index)} className="bg-primary hover:bg-primary/90">
            Elegir este coche
          </Button>
        </div>
      </div>
    </div>
  );
}