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

interface AddDeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (device: {
    serialNumber: string;
    macAddress: string;
    firmwareVersion?: string;
    hardwareVersion?: string;
    manufacturedDate?: string;
    deployedDate?: string;
  }) => Promise<void>;
}

export function AddDeviceDialog({
  open,
  onOpenChange,
  onAdd,
}: AddDeviceDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    serialNumber: '',
    macAddress: '',
    firmwareVersion: '',
    hardwareVersion: '',
    manufacturedDate: '',
    deployedDate: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onAdd({
        serialNumber: formData.serialNumber,
        macAddress: formData.macAddress,
        firmwareVersion: formData.firmwareVersion || undefined,
        hardwareVersion: formData.hardwareVersion || undefined,
        manufacturedDate: formData.manufacturedDate || undefined,
        deployedDate: formData.deployedDate || undefined,
      });

      // Reset form
      setFormData({
        serialNumber: '',
        macAddress: '',
        firmwareVersion: '',
        hardwareVersion: '',
        manufacturedDate: '',
        deployedDate: '',
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to add device:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add SecureBand Device</DialogTitle>
          <DialogDescription>
            Register a new SecureBand device in the system. Serial number and MAC address are required.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="serialNumber">
                Serial Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="serialNumber"
                value={formData.serialNumber}
                onChange={(e) =>
                  setFormData({ ...formData, serialNumber: e.target.value })
                }
                placeholder="DEV-12345"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="macAddress">
                MAC Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="macAddress"
                value={formData.macAddress}
                onChange={(e) =>
                  setFormData({ ...formData, macAddress: e.target.value })
                }
                placeholder="AA:BB:CC:DD:EE:FF"
                required
                pattern="^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$"
              />
              <p className="text-xs text-muted-foreground">
                Format: XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="firmwareVersion">Firmware Version</Label>
              <Input
                id="firmwareVersion"
                value={formData.firmwareVersion}
                onChange={(e) =>
                  setFormData({ ...formData, firmwareVersion: e.target.value })
                }
                placeholder="1.0.0"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="hardwareVersion">Hardware Version</Label>
              <Input
                id="hardwareVersion"
                value={formData.hardwareVersion}
                onChange={(e) =>
                  setFormData({ ...formData, hardwareVersion: e.target.value })
                }
                placeholder="HW-1.0"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manufacturedDate">Manufactured Date</Label>
              <Input
                id="manufacturedDate"
                type="date"
                value={formData.manufacturedDate}
                onChange={(e) =>
                  setFormData({ ...formData, manufacturedDate: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deployedDate">Deployed Date</Label>
              <Input
                id="deployedDate"
                type="date"
                value={formData.deployedDate}
                onChange={(e) =>
                  setFormData({ ...formData, deployedDate: e.target.value })
                }
              />
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
              {isSubmitting ? 'Adding...' : 'Add Device'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
