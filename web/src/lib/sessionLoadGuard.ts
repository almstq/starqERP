/** True only while a session data response still belongs to the active tenant load. */
export function isCurrentSessionDataLoad(
  requestGeneration: number,
  currentGeneration: number,
  requestOrganisationId: string | null,
  activeOrganisationId: string | null,
  cancelled: boolean,
): boolean {
  return !cancelled &&
    requestGeneration === currentGeneration &&
    requestOrganisationId === activeOrganisationId;
}
