local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local TAG = "FastWalkingPatapim"
local models = {}
local function add(model)
 if model:IsA("Model") then models[model]=true end
end
local function set(model, name, value)
 if model:GetAttribute(name) ~= value then model:SetAttribute(name,value) end
end
for _,model in CollectionService:GetTagged(TAG) do add(model) end
CollectionService:GetInstanceAddedSignal(TAG):Connect(add)
CollectionService:GetInstanceRemovedSignal(TAG):Connect(function(model)
 models[model]=nil
 set(model,"TargetUserId",0)
 set(model,"PatapimState","Walk")
end)
while true do
 local living = {}
 for _,player in Players:GetPlayers() do
  local character=player.Character
  local root=character and character:FindFirstChild("HumanoidRootPart")
  local humanoid=character and character:FindFirstChildOfClass("Humanoid")
  if root and humanoid and humanoid.Health>0 then
   table.insert(living,{player=player,position=root.Position})
  end
 end
 for model in models do
  if not model:IsDescendantOf(workspace) then
   models[model]=nil
  else
   local mesh=model:FindFirstChild("Mesh")
   local nearest
   local radius=math.clamp(model:GetAttribute("DetectionRadius") or 50,0,500)
   local best=radius*radius
   if mesh and mesh:IsA("BasePart") and model:GetAttribute("DetectionEnabled")~=false then
    for _,candidate in living do
     local offset=candidate.position-mesh.Position
     local squared=offset:Dot(offset)
     if squared<=best then nearest=candidate.player;best=squared end
    end
   end
   local state=nearest and "Punch" or "Walk"
   if state=="Punch" and model:GetAttribute("PatapimState")~="Punch" then
    model:SetAttribute("PunchStartedAt",workspace:GetServerTimeNow())
   end
   set(model,"TargetUserId",nearest and nearest.UserId or 0)
   set(model,"PatapimState",state)
  end
 end
 task.wait(.15)
end

