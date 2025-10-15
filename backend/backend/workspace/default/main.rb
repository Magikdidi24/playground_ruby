# Manipulation de tableaux
nombres = [1, 2, 3, 4, 5]
puts "Original: #{nombres.inspect}"
puts "Doublés: #{nombres.map { |n| n * 2 }.inspect}"
puts "Somme: #{nombres.sum}"