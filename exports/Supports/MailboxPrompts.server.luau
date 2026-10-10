local template
for _,item in workspace:GetDescendants() do
 if item:IsA("ProximityPrompt") and item:GetAttribute("PlatformRollPrompt")==true then template=item;break end
end
local function setup(part)
 if not part:IsA("BasePart") or part.Name:upper()~="MAILBOX" then return end
 local prompt=part:FindFirstChild("FeedbackPrompt")
 if prompt and not prompt:IsA("ProximityPrompt") then return end
 if not prompt then
  prompt=template and template:Clone() or Instance.new("ProximityPrompt")
  prompt:ClearAllChildren()
  prompt.Name="FeedbackPrompt"
 end
 prompt:SetAttribute("PlatformRollPrompt",nil)
 prompt:SetAttribute("FeedbackPrompt",true)
 prompt:SetAttribute("ServerPromptEnabled",true)
 prompt.ActionText="Send Feedback!"
 prompt.ObjectText=""
 prompt.Style=Enum.ProximityPromptStyle.Custom
 prompt.KeyboardKeyCode=Enum.KeyCode.E
 prompt.GamepadKeyCode=Enum.KeyCode.ButtonX
 prompt.HoldDuration=0
 prompt.MaxActivationDistance=12
 prompt.RequiresLineOfSight=false
 prompt.Exclusivity=Enum.ProximityPromptExclusivity.AlwaysShow
 prompt.Enabled=true
 prompt.Parent=part
end
workspace.DescendantAdded:Connect(setup)
for _,part in workspace:GetDescendants() do setup(part) end

