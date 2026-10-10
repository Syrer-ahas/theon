# Driving system

Drive uses the assigned plot's connected build around its Pilot Chair. A temporary physical vehicle is created, and the saved build is hidden during driving. Exit, death, character replacement, or leaving destroys the vehicle and restores the build. Driving never edits StoredBuild poses or consumes inventory.

Controls: WASD/arrows, Space to brake, E to exit. Drive can also be clicked again to exit. Touch controls and gamepad steering are supported. The normal Roblox camera remains active.

Wheel capacities stack: Standard 120 kg, Violet 250 kg, Golden 500 kg. Their weights are 8, 10, and 12 kg. Only connected upright tires near the bottom of the car contribute capacity. Decorative tires still add weight. At least two usable tires are required.

Engines stack power. Basic/Eco/Cobalt/Crimson/Golden/Turbo/Royal weigh 10/11/12/14/16/19/22 kg, with base speed ratings 38/44/52/62/72/90/105 studs per second. Actual speed depends on total weight and engine power. Multiple engines provide diminishing speed bonuses, capped at 120 studs per second. The driver adds 75 balance kg. Fuel consumption and passenger transport are not implemented in this iteration.

VehicleStats contains the balance values. VehicleDriving.server controls seating, validation, physics, tire rotation, and cleanup. VehicleDriving.client connects the existing ScreenGui.Drive button, inputs, and driving HUD. PlotBuilding refuses edits while IsDriving is true.

Studio validation: real keyboard acceleration (~29.4 studs/s with one Basic Engine), steering, reverse, braking, E exit, four rotating axles, seat occupancy, and original part restoration passed. Missing pilot, missing engine, and an 813 kg / 480 kg overload returned explicit errors. Temporary test builds never entered saved build data. Production DataStore saving is restored.
