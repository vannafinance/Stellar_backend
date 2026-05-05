"use client";

import { AddressBadge } from "@/components/ui/address-badge";

interface MarginAccountAddressProps {
  address: string | null;
  className?: string;
  network?: "testnet" | "public";
}

export const MarginAccountAddress = ({
  address,
  className = "",
  network = "testnet",
}: MarginAccountAddressProps) => {
  if (!address) return null;

  return (
    <AddressBadge
      address={address}
      label="Account:"
      network={network}
      className={className}
    />
  );
};
