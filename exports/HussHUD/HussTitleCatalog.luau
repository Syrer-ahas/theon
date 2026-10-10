local Catalog={
 {Id="Goat",Name="The Goat",Color=Color3.fromRGB(255,205,74),Style="LEGEND"},
 {Id="Beast",Name="The Beast",Color=Color3.fromRGB(255,108,83),Style="POWER"},
 {Id="DodgeKing",Name="Dodge King",Color=Color3.fromRGB(182,141,255),Style="ROYAL"},
 {Id="DodgeQueen",Name="Dodge Queen",Color=Color3.fromRGB(255,143,206),Style="ROYAL"},
 {Id="Untouchable",Name="Untouchable",Color=Color3.fromRGB(106,231,255),Style="EVASION"},
 {Id="Sharpshooter",Name="Sharpshooter",Color=Color3.fromRGB(255,178,100),Style="AIM"},
 {Id="ClutchCatcher",Name="Clutch Catcher",Color=Color3.fromRGB(105,242,188),Style="CATCH"},
 {Id="BallStorm",Name="Ball Storm",Color=Color3.fromRGB(121,167,255),Style="THROW"},
 {Id="LastDodger",Name="Last Dodger",Color=Color3.fromRGB(228,219,151),Style="SURVIVAL"},
 {Id="QuickDraw",Name="Quick Draw",Color=Color3.fromRGB(255,149,104),Style="THROW"},
 {Id="SlideMaster",Name="Slide Master",Color=Color3.fromRGB(128,242,225),Style="MOVEMENT"},
 {Id="AnkleBreaker",Name="Ankle Breaker",Color=Color3.fromRGB(179,244,108),Style="MOVEMENT"},
 {Id="IronHands",Name="Iron Hands",Color=Color3.fromRGB(184,204,226),Style="CATCH"},
 {Id="NoMercy",Name="No Mercy",Color=Color3.fromRGB(255,113,147),Style="POWER"},
 {Id="ValleyLegend",Name="Valley Legend",Color=Color3.fromRGB(237,196,116),Style="LEGEND"},
 {Id="CanyonGhost",Name="Canyon Ghost",Color=Color3.fromRGB(210,179,250),Style="EVASION"},
 {Id="Crossline",Name="Crossline Champion",Color=Color3.fromRGB(123,221,145),Style="VICTORY"},
 {Id="Comeback",Name="Comeback Kid",Color=Color3.fromRGB(255,181,210),Style="CLUTCH"},
 {Id="RoundBreaker",Name="Round Breaker",Color=Color3.fromRGB(168,169,255),Style="VICTORY"},
 {Id="HussHero",Name="Huss Hero",Color=Color3.fromRGB(255,221,132),Style="LEGEND"},
}
local rules={
 Goat={Description="Win 50 matches, tag 100 dodgers & catch 25 balls.",Requirements={{Key="Wins",Goal=50},{Key="Tags",Goal=100},{Key="Catches",Goal=25}}},
 Beast={Description="Tag 75 dodgers and catch 10 balls.",Requirements={{Key="Tags",Goal=75},{Key="Catches",Goal=10}}},
 DodgeKing={Description="Win 25 matches as a dodger.",Requirements={{Key="Wins",Goal=25}}},
 DodgeQueen={Description="Win 25 matches as a dodger.",Requirements={{Key="Wins",Goal=25}}},
 Untouchable={Description="Win 50 matches as a dodger.",Requirements={{Key="Wins",Goal=50}}},
 Sharpshooter={Description="Tag 25 dodgers with your throws.",Requirements={{Key="Tags",Goal=25}}},
 ClutchCatcher={Description="Catch 5 incoming balls.",Requirements={{Key="Catches",Goal=5}}},
 BallStorm={Description="Tag 50 dodgers with your throws.",Requirements={{Key="Tags",Goal=50}}},
 LastDodger={Description="Win as the last remaining dodger.",Requirements={{Key="LastWins",Goal=1}}},
 QuickDraw={Description="Tag 5 dodgers with your throws.",Requirements={{Key="Tags",Goal=5}}},
 SlideMaster={Description="Use 50 slides during active matches.",Requirements={{Key="Slides",Goal=50}}},
 AnkleBreaker={Description="Use 150 slides during active matches.",Requirements={{Key="Slides",Goal=150}}},
 IronHands={Description="Catch 10 incoming balls.",Requirements={{Key="Catches",Goal=10}}},
 NoMercy={Description="Tag 100 dodgers with your throws.",Requirements={{Key="Tags",Goal=100}}},
 ValleyLegend={Description="Win 10 matches in Classic Valley.",Requirements={{Key="ValleyWins",Goal=10}}},
 CanyonGhost={Description="Win 5 matches in Desert Canyon.",Requirements={{Key="CanyonWins",Goal=5}}},
 Crossline={Description="Win 10 matches as a dodger.",Requirements={{Key="Wins",Goal=10}}},
 Comeback={Description="Win after 3 or more matches without a dodger win.",Requirements={{Key="ComebackWins",Goal=1}}},
 RoundBreaker={Description="Win 15 matches as a dodger.",Requirements={{Key="Wins",Goal=15}}},
 HussHero={Description="Win your first match as a dodger.",Requirements={{Key="Wins",Goal=1}}}
}
for _,item in ipairs(Catalog) do
 item.Description=rules[item.Id].Description item.Requirements=rules[item.Id].Requirements
end
local byId={}
for _,item in ipairs(Catalog) do byId[item.Id]=item end
return {Items=Catalog,ById=byId}
