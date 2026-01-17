'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AddInmateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (inmate: {
    inmateNumber: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    admissionDate?: string;
    status?: string;
  }) => Promise<void>;
}

export function AddInmateDialog({
  open,
  onOpenChange,
  onAdd,
}: AddInmateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    inmateNumber: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    admissionDate: '',
    status: 'active',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onAdd({
        inmateNumber: formData.inmateNumber,
        firstName: formData.firstName,
        lastName: formData.lastName,
        dateOfBirth: formData.dateOfBirth || undefined,
        admissionDate: formData.admissionDate || undefined,
        status: formData.status || undefined,
      });

      // Reset form
      setFormData({
        inmateNumber: '',
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        admissionDate: '',
        status: 'active',
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to add inmate:', error);
      alert('Failed to add inmate. Please check the console for details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Inmate</DialogTitle>
          <DialogDescription>
            Register a new inmate in the system. Inmate number, first name, and last name are required.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="inmateNumber">
                Inmate Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="inmateNumber"
                value={formData.inmateNumber}
                onChange={(e) =>
                  setFormData({ ...formData, inmateNumber: e.target.value })
                }
                placeholder="INM-12345"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="firstName">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  placeholder="John"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="lastName">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  placeholder="Doe"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) =>
                    setFormData({ ...formData, dateOfBirth: e.target.value })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="admissionDate">Admission Date</Label>
                <Input
                  id="admissionDate"
                  type="date"
                  value={formData.admissionDate}
                  onChange={(e) =>
                    setFormData({ ...formData, admissionDate: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Inmate'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
