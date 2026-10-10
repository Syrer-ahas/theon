local items={
 {Id="Classic",Name="VALLEY ORIGINAL",Price=0,Color=Color3.fromRGB(199,48,43),Rarity="STANDARD",Description="A classic red rubber dodgeball with dark stitched panel seams.",Style="Seams"},
 {Id="Ocean",Name="OCEAN SURGE",Price=100,Color=Color3.fromRGB(40,128,175),Rarity="RARE",Description="A blue court ball with a matte finish and clean dark seams.",Style="Rings"},
 {Id="Lime",Name="LIME PULSE",Price=150,Color=Color3.fromRGB(73,155,90),Rarity="RARE",Description="A green rubber court ball with durable stitched panels.",Style="Rings"},
 {Id="Gold",Name="GOLDEN CROWN",Price=250,Color=Color3.fromRGB(187,145,46),Rarity="EPIC",Description="A warm gold court ball with understated dark panel seams.",Style="Studs"},
 {Id="Candy",Name="CANDY BONKER",Price=400,Color=Color3.fromRGB(196,90,131),Rarity="EPIC",Description="A rose pink court ball with cream stitching.",Style="Rings"},
 {Id="Frost",Name="GLACIAL CROWN",Price=550,Color=Color3.fromRGB(107,166,180),Rarity="LEGENDARY",Description="Powder blue rubber with three navy stitched panel seams.",Style="Seams",Gamepass=true},
 {Id="Solar",Name="SOLAR PHOENIX",Price=600,Color=Color3.fromRGB(207,114,43),Rarity="LEGENDARY",Description="Burnt orange rubber with cream stitched panels.",Style="Seams",Gamepass=true},
 {Id="Molten",Name="MOLTEN FANG",Price=700,Color=Color3.fromRGB(119,52,46),Rarity="LEGENDARY",Description="Deep brick red rubber with charcoal stitching.",Style="Crystals"},
 {Id="Void",Name="VOID SOVEREIGN",Price=750,Color=Color3.fromRGB(86,68,124),Rarity="LEGENDARY",Description="Matte violet rubber with understated lavender seams.",Style="Seams",Gamepass=true},
 {Id="Spectral",Name="SPECTRAL REAPER",Price=800,Color=Color3.fromRGB(66,144,122),Rarity="LEGENDARY",Description="Muted mint rubber with dark stitched panel seams.",Style="Orbit"},
 {Id="Storm",Name="STORM TALON",Price=850,Color=Color3.fromRGB(101,118,160),Rarity="LEGENDARY",Description="Slate blue rubber with classic dark panel stitching.",Style="Flames"},
 {Id="Dragon",Name="CELESTIAL DRAGON",Price=900,Color=Color3.fromRGB(43,130,144),Rarity="LEGENDARY",Description="Deep teal rubber with gold panel seams.",Style="Seams",Gamepass=true}
}
local byId={} for _,item in ipairs(items) do byId[item.Id]=item end
return {Items=items,ById=byId}
