local PlotOwnership = {}

function PlotOwnership.FindPlot(instance)
	local current = instance
	while current and current ~= workspace do
		if (current:IsA("Folder") or current:IsA("Model")) and current.Name:match("^Plot%d+$") then
			return current
		end
		current = current.Parent
	end
	return nil
end

function PlotOwnership.CanUse(player, instance)
	local plot = PlotOwnership.FindPlot(instance)
	return plot ~= nil
		and plot:GetAttribute("OwnerUserId") == player.UserId
		and player:GetAttribute("PlotName") == plot.Name
end

return PlotOwnership
