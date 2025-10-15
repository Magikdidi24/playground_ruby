# Définition d'une classe
class Voiture
  attr_accessor :marque, :modele, :annee
  
  def initialize(marque, modele, annee)
    @marque = marque
    @modele = modele
    @annee = annee
  end
  
  def afficher
    puts "#{@marque} #{@modele} (#{@annee})"
  end
end

voiture = Voiture.new("Toyota", "Corolla", 2023)
voiture.afficher