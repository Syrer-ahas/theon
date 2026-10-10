Item collection now saves a permanent `discovered` map inside the existing BuildInventory_v1 record (version 1, backward compatible).

ServerScriptService.ItemDiscovery seeds discoveries from previous inventory and stored builds, records new inventory items when their quantity becomes positive, and preserves discoveries when quantities drop to zero. PlayerInventoryData loads, snapshots, and saves the map with the existing session lease and retries.

IndexCategories reacts to replicated DiscoveredItems flags. Mapped icons use IndexItemId, become full color once discovered, and otherwise remain black. The existing index layout and category buttons are preserved. Cards are bound to the available catalog in ascending declared Odds order, using inventory artwork and catalog Odds. Unused engine/wheel cards remain reserved silhouettes; supports are saved in discovery history but the current index has no Supports category.

Verified: legacy inventory/build migration, new item unlock, unlock retained after consumption/removal, save serialization round trip, tracker cleanup, loaded discoveries and live UI color updates in Studio. No test items were granted to the player's saved inventory.
