using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace AsiloWeb.Models
{
    // Catalogo de medicamentos de la farmacia con sus existencias.
    // Al despachar un medicamento elegido de aqui se descuentan las unidades (ver LaboratorioFarmaciaController).
    [Table("TBL_INVENTARIO_MEDICAMENTOS")]
    [Index(nameof(Nombre), IsUnique = true)]
    public class InventarioMedicamento
    {
        [Key]
        [Column("id_inventario")]
        public int IdInventario { get; set; }

        [Required]
        [StringLength(150)]
        [Column("nombre")]
        public string Nombre { get; set; } = string.Empty;

        [StringLength(100)]
        [Column("presentacion")]
        public string? Presentacion { get; set; }

        // Precio por unidad de despacho (tableta, frasco, inhalador...)
        [Column("precio_unitario")]
        public decimal PrecioUnitario { get; set; } = 0;

        [Column("existencias")]
        public int Existencias { get; set; } = 0;

        // Con esta cantidad o menos se avisa que el producto esta bajo
        [Column("stock_minimo")]
        public int StockMinimo { get; set; } = 0;

        [Column("fecha_vencimiento")]
        public DateTime? FechaVencimiento { get; set; }
    }
}
