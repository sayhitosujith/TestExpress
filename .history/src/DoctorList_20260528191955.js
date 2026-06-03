import { useState } from 'react';
import { useEntityGetAll } from '@blocksdiy/blocks-client-sdk/reactSdk';
import { DentistsEntity } from '@/product-types';
import type { IDentistsEntity, DentistsEntitySpecializationEnum } from '@/product-types';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { DentistCard } from '@/components/DentistCard';
import { DentistFormModal } from '@/components/DentistFormModal';
import { DentistDetailSheet } from '@/components/DentistDetailSheet';
import { Skeleton } from '@/components/ui/skeleton';

const specializations: DentistsEntitySpecializationEnum[] = [
  'General Dentist', 'Orthodontist', 'Periodontist', 'Endodontist',
  'Oral Surgeon', 'Pediatric Dentist', 'Prosthodontist',
];

export default function Dentists() {
  const { data: dentists, isLoading } = useEntityGetAll(DentistsEntity);
  const [specFilter, setSpecFilter] = useState<string>('All');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedDentist, setSelectedDentist] = useState<(IDentistsEntity & { id: string }) | null>(null);

  const filtered = specFilter === 'All'
    ? dentists
    : dentists?.filter((d) => d.specialization === specFilter);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Select value={specFilter} onValueChange={setSpecFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by specialization" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Specializations</SelectItem>
            {specializations.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button onClick={() => setCreateOpen(true)}>
          <Plus data-icon="inline-start" />
          New Dentist
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered?.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No dentists found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered?.map((dentist) => (
            <DentistCard
              key={dentist.id}
              dentist={dentist}
              onViewProfile={() => setSelectedDentist(dentist)}
            />
          ))}
        </div>
      )}

      <DentistFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <DentistDetailSheet
        open={!!selectedDentist}
        onClose={() => setSelectedDentist(null)}
        dentist={selectedDentist}
      />
    </div>
  );
}
