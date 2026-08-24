/* R6 compatibility facade. Catalog/backup/Trash ownership moved to services/catalog.js. */
export {
  MAIN_KEY,
  ADULT_KEY,
  TRASH_KEY,
  BACKUP_INDEX_KEY,
  BACKUP_PREFIX,
  BACKUP_LIMIT,
  loadCatalogPair,
  saveCatalog,
  saveCatalogPair,
  invalidateCatalogCache,
  listBackups,
  snapshotCatalogs,
  loadBackup,
  loadTrash,
  saveTrash,
  appendTrashItem,
  seriesObjectKeys,
  trashItemKeys
} from "../services/catalog.js";
export { mediaKey } from "../services/validation.js";
