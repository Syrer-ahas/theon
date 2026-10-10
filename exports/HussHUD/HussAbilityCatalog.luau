local items={
 {Id="Shield",Name="ONE HIT SHIELD",Role="Runner",Icon="S",Cooldown=22,Duration=4,Color=Color3.fromRGB(92,200,238),Description="Block one incoming ball for up to 4 seconds."},
 {Id="Ghost",Name="GHOST STEP",Role="Runner",Icon="G",Cooldown=18,Duration=.65,Color=Color3.fromRGB(155,143,239),Description="Slip through incoming balls for 0.65 seconds."},
 {Id="CatchBoost",Name="QUICK HANDS",Role="Runner",Icon="C",Cooldown=16,Duration=.85,Color=Color3.fromRGB(95,226,166),Description="Immediately open a longer 0.85-second catch window."},
 {Id="SecondWind",Name="SECOND WIND",Role="Runner",Icon="W",Cooldown=20,Duration=3,Color=Color3.fromRGB(243,205,94),Description="Gain 15% movement speed for 3 seconds."},
 {Id="DashReset",Name="DASH RESET",Role="Runner",Icon="D",Cooldown=20,Duration=0,Color=Color3.fromRGB(93,173,241),Description="Instantly recharge your slide."},
 {Id="QuickFire",Name="QUICK FIRE",Role="Thrower",Icon="F",Cooldown=20,Duration=4,Color=Color3.fromRGB(241,125,83),Description="Throw twice as often for 4 seconds."},
 {Id="PowerThrow",Name="POWER THROW",Role="Thrower",Icon="P",Cooldown=22,Duration=4,Color=Color3.fromRGB(235,91,94),Description="Throw balls 20% faster for 4 seconds."},
 {Id="BigBall",Name="BIG BALL",Role="Thrower",Icon="B",Cooldown=24,Duration=4,Color=Color3.fromRGB(229,174,88),Description="Your next throw within 4 seconds is 20% larger."},
 {Id="Pierce",Name="SHIELD BREAKER",Role="Thrower",Icon="X",Cooldown=24,Duration=4,Color=Color3.fromRGB(202,114,217),Description="Your next throw within 4 seconds pierces a shield."},
 {Id="Adrenaline",Name="ADRENALINE",Role="Both",Icon="A",Cooldown=24,Duration=3,Color=Color3.fromRGB(123,206,115),Description="Move 10% faster with 25% shorter throw and catch cooldowns for 3 seconds."}
}
local byId={} for _,v in ipairs(items) do byId[v.Id]=v end
return {Items=items,ById=byId}
