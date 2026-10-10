local HttpService = game:GetService("HttpService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Starter = {}

function Starter.NewRecord(money)
 local builds = {}
 for _,template in ReplicatedStorage:WaitForChild("StarterBuildTemplates"):GetChildren() do
  local pose = template:FindFirstChild("StarterPose")
  assert(pose and pose:IsA("CFrameValue"), "Starter car pose missing")
  table.insert(builds, {
   uid = HttpService:GenerateGUID(false),
   id = template:GetAttribute("BuildItemId"),
   template = template.Name,
   pose = {pose.Value:GetComponents()},
  })
 end
 assert(#builds > 0, "Starter car has no parts")
 return {version=1, money=money, items={}, builds=builds, starterCarGranted=true}
end

return Starter
