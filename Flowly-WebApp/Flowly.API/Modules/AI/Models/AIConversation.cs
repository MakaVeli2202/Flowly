using System.ComponentModel.DataAnnotations;

namespace Flowly.API.Modules.AI.Models
{
    public class AIConversation
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public int OrgId { get; set; }
        public int? UserId { get; set; }

        [Required, StringLength(50)]
        public string ContextType { get; set; } = string.Empty;

        public string MessagesJson { get; set; } = "[]";
        public int TotalTokensUsed { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ExpiresAt { get; set; }
    }
}
