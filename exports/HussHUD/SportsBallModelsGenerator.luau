
local RS=game.ReplicatedStorage
local folder=RS.HussBallModels folder:ClearAllChildren()
local palette={
 Classic={199,48,43},Ocean={40,128,175},Lime={73,155,90},Gold={187,145,46},Candy={196,90,131},
 Frost={107,166,180},Solar={207,114,43},Molten={119,52,46},Void={86,68,124},Spectral={66,144,122},Storm={101,118,160},Dragon={43,130,144}
}
local premium={Solar=true,Void=true,Frost=true,Dragon=true}
local seams={Solar=Color3.fromRGB(240,210,153),Void=Color3.fromRGB(169,157,194),Frost=Color3.fromRGB(40,66,78),Dragon=Color3.fromRGB(206,169,88),Candy=Color3.fromRGB(243,220,217),Gold=Color3.fromRGB(65,57,41)}
local function part(model,name,size,cf,color)
 local p=Instance.new("Part") p.Name=name p.Size=size p.CFrame=cf p.Color=color p.Material=Enum.Material.SmoothPlastic p.Reflectance=.035 p.Anchored=true p.CanCollide=false p.CanTouch=false p.CanQuery=false p.TopSurface=Enum.SurfaceType.Smooth p.BottomSurface=Enum.SurfaceType.Smooth p.Parent=model return p
end
for id,rgb in pairs(palette) do
 local model=Instance.new("Model") model.Name=id model.Parent=folder
 local core=part(model,"Core",Vector3.new(3,3,3),CFrame.identity,Color3.fromRGB(table.unpack(rgb))) core.Shape=Enum.PartType.Ball model.PrimaryPart=core
 local seam=seams[id] or Color3.fromRGB(32,37,40)
 for band=1,(premium[id] and 3 or 2) do
  local rotation=band==1 and CFrame.Angles(math.rad(35),0,0) or band==2 and CFrame.Angles(0,math.rad(90),math.rad(-35)) or CFrame.Angles(math.rad(90),0,0)
  for i=0,23 do
   local a=i/24*math.pi*2 local b=(i+1)/24*math.pi*2
   local p1=rotation:PointToWorldSpace(Vector3.new(math.cos(a),math.sin(a),0)*1.515)
   local p2=rotation:PointToWorldSpace(Vector3.new(math.cos(b),math.sin(b),0)*1.515)
   part(model,"PanelSeam",Vector3.new(.035,.035,(p2-p1).Magnitude+.008),CFrame.lookAt((p1+p2)*.5,p2),seam)
  end
 end
 model:SetAttribute("SportsBall",true)
end
return #folder:GetChildren()

