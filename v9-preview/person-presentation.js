export function personInitial(name) {
  const first=String(name??'').normalize('NFKC').match(/[\p{L}\p{N}]/u);
  return first ? first[0].toUpperCase() : null;
}
