'use client';

import { AlertTriangle } from 'lucide-react';
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

interface RemoveDeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceSerial: string;
  onRemove: (reason: string) => Promise<void>;
}

export function RemoveDeviceDialog({
  open,
  onOpenChange,
  deviceSerial,
  onRemove,
}: RemoveDeviceDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onRemove(reason);
      setReason('');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to remove device:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Remove SecureBand Device
          </DialogTitle>
          <DialogDescription>
            This action will revoke device <strong>{deviceSerial}</strong>. The device will be marked as revoked and cannot be used again. This action is logged and requires admin approval.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="text-sm font-medium text-destructive">
                Warning: This action cannot be undone.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                The device will be permanently marked as revoked. Make sure the device is not currently assigned to an inmate.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reason">
                Reason for Removal <span className="text-destructive">*</span>
              </Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Device damaged, returned to manufacturer"
                required
              />
              <p className="text-xs text-muted-foreground">
                This reason will be logged in the audit trail.
              </p>
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
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting ? 'Removing...' : 'Remove Device'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
