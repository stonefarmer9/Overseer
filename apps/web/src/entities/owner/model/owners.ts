export const OWNERS = [
  { id: 'red', name: 'Red', colour: '#dc2626' },
  { id: 'blue', name: 'Blue', colour: '#2563eb' },
  { id: 'green', name: 'Green', colour: '#16a34a' },
];

export type Owner = (typeof OWNERS)[number];
export type OwnerId = Owner['id'];

export function getOwner(id: string): Owner | undefined {
  return OWNERS.find((owner) => owner.id === id);
}
