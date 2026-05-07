import { Button } from "@/components/ui/button";
import { Star, MapPin, ExternalLink } from "lucide-react";

export type AccommodationOption = {
  id?: string;
  provider?: "booking" | "airbnb" | string;
  name: string;
  price_per_night?: number | null;
  price_total?: number | null;
  currency?: string;
  rating?: number | null;
  reviews?: number | null;
  address?: string;
  checkin?: string;
  checkout?: string;
  cancelacion_gratis?: boolean;
  photos?: string[];
  url?: string | null;
  tipo?: string;
};

function Stars({ score }: { score: number }) {
  // score is 0-10, convert to 0-5
  const s = Math.max(0, Math.min(5, score / 2));
  const full = Math.floor(s);
  const half = s - full >= 0.5;
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          className="h-3.5 w-3.5"
          fill={i < full || (i === full && half) ? "currentColor" : "none"}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

export default function OptionCard({
  option,
  index,
  onChoose,
  disabled,
}: {
  option: AccommodationOption;
  index: number;
  onChoose: (opt: AccommodationOption, index: number) => void;
  disabled?: boolean;
}) {
  const photo = option.photos?.[0];
  const currency = option.currency ?? "EUR";
  return (
    <div className="group flex flex-col sm:flex-row overflow-hidden rounded-2xl border border-border bg-card shadow-soft hover:shadow-elegant transition-all">
      <div className="sm:w-48 sm:shrink-0 h-44 sm:h-auto bg-muted relative overflow-hidden">
        {photo ? (
          <img src={photo} alt={option.name} loading="lazy" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">Sin foto</div>
        )}
        <span
          className={
            "absolute top-2 left-2 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full text-white " +
            (option.provider === "airbnb" ? "bg-red-600" : "bg-blue-600")
          }
        >
          {(option.provider ?? "booking").toUpperCase()}
        </span>
      </div>

      <div className="flex-1 p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="font-display font-semibold text-base leading-tight truncate">
              {option.name}
            </h4>
            {option.address && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3" /> <span className="truncate">{option.address}</span>
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            {option.price_per_night != null ? (
              <>
                <div className="font-display text-lg font-bold text-primary leading-none">
                  {Math.round(option.price_per_night)} {currency === "EUR" ? "€" : currency}
                </div>
                <div className="text-[11px] text-muted-foreground">/ noche</div>
                {option.price_total != null && (
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Total {Math.round(option.price_total)} €
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs text-muted-foreground">Precio bajo consulta</div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {option.rating != null && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">
              <Stars score={option.rating} />
              {option.rating.toFixed(1)}/10
              {option.reviews ? <span className="text-muted-foreground">({option.reviews})</span> : null}
            </span>
          )}
          {option.cancelacion_gratis ? (
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              Cancelación gratis
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
              No reembolsable
            </span>
          )}
          {option.tipo && (
            <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium capitalize">
              {option.tipo}
            </span>
          )}
          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            Factura corporativa
          </span>
        </div>

        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          {option.url ? (
            <a
              href={option.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" /> Ver en Booking
            </a>
          ) : <span />}
          <Button
            size="sm"
            disabled={disabled}
            onClick={() => onChoose(option, index)}
            className="bg-primary hover:bg-primary/90"
          >
            Elegir esta opción
          </Button>
        </div>
      </div>
    </div>
  );
}