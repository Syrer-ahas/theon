-- Maximum mode strips world texture layers locally; UI artwork is preserved.
local Players=game:GetService('Players')
local player=Players.LocalPlayer
local records={}
local appearances={}
local maximum=false
local function apply(object,record)
 if not object.Parent then return end
 if object:IsA('Decal') or object:IsA('Texture') then
  object.Transparency=maximum and 1 or record.Transparency
 elseif object:IsA('MeshPart') then
  object.TextureID=maximum and '' or record.TextureID
 elseif object:IsA('SpecialMesh') then
  object.TextureId=maximum and '' or record.TextureId
 elseif object:IsA('Shirt') then
  object.ShirtTemplate=maximum and '' or record.ShirtTemplate
 elseif object:IsA('Pants') then
  object.PantsTemplate=maximum and '' or record.PantsTemplate
 elseif object:IsA('ShirtGraphic') then
  object.Graphic=maximum and '' or record.Graphic
 elseif object:IsA('ParticleEmitter') or object:IsA('Beam') or object:IsA('Trail') then
  object.Texture=maximum and '' or record.Texture
 end
 if object:IsA('BasePart') then
  object.MaterialVariant=maximum and '' or record.MaterialVariant
  object.Material=maximum and Enum.Material.SmoothPlastic or record.Material
 end
end
local function appearance(object)
 if appearances[object] then return end
 local parent=object.Parent
 local record={parent=parent}
 appearances[object]=record
 record.connection=parent.Destroying:Connect(function()
  appearances[object]=nil
  record.connection:Disconnect()
  if not object.Parent then object:Destroy() end
 end)
 if maximum then object.Parent=nil end
end
local function register(object)
 if not object:IsDescendantOf(workspace) then return end
 if object:IsA('SurfaceAppearance') then appearance(object);return end
 if records[object] then return end
 local r={}
 if object:IsA('Decal') or object:IsA('Texture') then r.Transparency=object.Transparency
 elseif object:IsA('MeshPart') then r.TextureID=object.TextureID
 elseif object:IsA('SpecialMesh') then r.TextureId=object.TextureId
 elseif object:IsA('Shirt') then r.ShirtTemplate=object.ShirtTemplate
 elseif object:IsA('Pants') then r.PantsTemplate=object.PantsTemplate
 elseif object:IsA('ShirtGraphic') then r.Graphic=object.Graphic
 elseif object:IsA('ParticleEmitter') or object:IsA('Beam') or object:IsA('Trail') then r.Texture=object.Texture
 elseif not object:IsA('BasePart') then return end
 if object:IsA('BasePart') then r.Material=object.Material;r.MaterialVariant=object.MaterialVariant end
 records[object]=r
 apply(object,r)
end
local function update()
 maximum=player:GetAttribute('Setting_PerformanceMode')==2
 for object,record in records do apply(object,record) end
 for object,record in appearances do
  if maximum then object.Parent=nil
  elseif record.parent.Parent then object.Parent=record.parent end
 end
end
maximum=player:GetAttribute('Setting_PerformanceMode')==2
for _,n in workspace:GetDescendants() do register(n) end
workspace.DescendantAdded:Connect(register)
workspace.DescendantRemoving:Connect(function(n)
 if not appearances[n] then records[n]=nil end
end)
player:GetAttributeChangedSignal('Setting_PerformanceMode'):Connect(update)
